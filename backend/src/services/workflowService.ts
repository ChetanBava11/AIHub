import { AppError } from "../lib/errors";
import { createGeminiClient, chat } from "../lib/gemini";
import { logAudit } from "../lib/auditLogger";
import { scopedPrisma } from "../lib/scopedPrisma";
import { ContactService, type CreateContactInput } from "./contactService";
import { createTask } from "../tools/createTask";
import { sendWhatsApp } from "../tools/sendWhatsApp";

type LeadQualificationInput = {
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
};

type WorkflowAction =
  | { type: "whatsapp"; message: string; result: unknown }
  | { type: "task"; taskId: string; dueDate: Date };

type LeadScoreResult = {
  score: number;
  reasoning: string;
};

type WorkflowResult = {
  contact: Record<string, unknown>;
  score: number;
  reasoning: string;
  actionsTaken: WorkflowAction[];
};

const buildLeadScorePrompt = (input: LeadQualificationInput) => {
  return `You are a lead qualification assistant. Score this lead from 0 to 100 based on the provided information. Return only valid JSON with numeric score and reasoning.

Lead:
- Name: ${input.name}
- Phone: ${input.phone}
- Email: ${input.email ?? "N/A"}
- Company: ${input.company ?? "N/A"}
- Notes: ${input.notes ?? "N/A"}

Output:
{ "score": number, "reasoning": string }`;
};

const buildFollowUpPrompt = (
  contact: CreateContactInput,
  score: number,
  reasoning: string,
  notes?: string | null
) => {
  return `You are a sales assistant. Create a personalized WhatsApp follow-up message for a high-value lead.

Lead:
- Name: ${contact.name}
- Company: ${contact.company ?? "N/A"}
- Notes: ${notes ?? "N/A"}
- Lead score: ${score}
- Reasoning: ${reasoning}

Write one concise message in plain text suitable for WhatsApp. Do not include any JSON.`;
};

const parseJsonResponse = <T>(text: string): T => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Unable to parse Gemini response as JSON.");
  }

  return JSON.parse(match[0]) as T;
};

export class WorkflowService {
  private readonly geminiClient = createGeminiClient();
  private readonly contactService = new ContactService();

  async qualifyLead(
    tenantId: string,
    userId: string,
    input: LeadQualificationInput
  ): Promise<WorkflowResult> {
    const contact = await this.contactService.createContact(tenantId, userId, {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      company: input.company ?? null,
      status: "LEAD"
    });

    await logAudit({
      tenantId,
      userId,
      action: "WORKFLOW_LEAD_QUALIFICATION_STARTED",
      details: {
        contactId: contact.id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        company: input.company
      }
    });

    const leadScoreResult = await this.scoreLead(input);

    await this.updateContactScore(
      tenantId,
      contact.id,
      leadScoreResult.score,
      leadScoreResult.reasoning
    );

    await logAudit({
      tenantId,
      userId,
      action: "WORKFLOW_LEAD_SCORED",
      details: {
        contactId: contact.id,
        score: leadScoreResult.score,
        reasoning: leadScoreResult.reasoning
      }
    });

    const actionsTaken: WorkflowAction[] = [];

    if (leadScoreResult.score > 80) {
      const followUpMessage = await this.generateFollowUpMessage(contact, leadScoreResult, input.notes);

      const whatsappResult = await sendWhatsApp({
        tenantId,
        userId,
        contactId: contact.id,
        message: followUpMessage
      });

      await logAudit({
        tenantId,
        userId,
        action: "WHATSAPP_SENT",
        details: {
          contactId: contact.id,
          messageLength: followUpMessage.length,
          success: whatsappResult?.success ?? false
        }
      });

      actionsTaken.push({
        type: "whatsapp",
        message: followUpMessage,
        result: whatsappResult
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const task = await createTask({
        tenantId,
        userId,
        contactId: contact.id,
        description: "Follow up with high-value lead",
        dueDate: dueDate.toISOString()
      });

      await logAudit({
        tenantId,
        userId,
        action: "TASK_CREATED",
        details: {
          contactId: contact.id,
          taskId: task.id
        }
      });

      actionsTaken.push({
        type: "task",
        taskId: task.id,
        dueDate: task.dueDate
      });

      await logAudit({
        tenantId,
        userId,
        action: "WORKFLOW_LEAD_QUALIFICATION_SUCCESS",
        details: {
          score: leadScoreResult.score,
          contactId: contact.id,
          taskId: task.id
        }
      });
    } else {
      await logAudit({
        tenantId,
        userId,
        action: "WORKFLOW_LEAD_QUALIFICATION_LOW_SCORE",
        details: {
          score: leadScoreResult.score,
          contactId: contact.id
        }
      });
    }

    const updatedContact = await scopedPrisma(tenantId).contact.findFirst({
      where: {
        id: contact.id
      }
    });

    if (!updatedContact) {
      throw new AppError("Contact not found after workflow update.", 500);
    }

    await logAudit({
      tenantId,
      userId,
      action: "WORKFLOW_LEAD_QUALIFICATION_FINISHED",
      details: {
        contactId: contact.id,
        score: leadScoreResult.score,
        actionsTaken: actionsTaken.map((action) => action.type)
      }
    });

    return {
      contact: updatedContact,
      score: leadScoreResult.score,
      reasoning: leadScoreResult.reasoning,
      actionsTaken
    };
  }

  private async scoreLead(input: LeadQualificationInput): Promise<LeadScoreResult> {
    const prompt = buildLeadScorePrompt(input);
    const response = await chat(this.geminiClient, {
      messages: [{ role: "system", content: prompt }],
      temperature: 0.2,
      maxOutputTokens: 256
    });

    const parsed = parseJsonResponse<LeadScoreResult>(response);

    if (
      typeof parsed.score !== "number" ||
      Number.isNaN(parsed.score) ||
      parsed.score < 0 ||
      parsed.score > 100 ||
      typeof parsed.reasoning !== "string"
    ) {
      throw new AppError("Gemini returned an invalid lead score response.", 500);
    }

    return {
      score: Math.round(parsed.score),
      reasoning: parsed.reasoning.trim()
    };
  }

  private async generateFollowUpMessage(
    contact: CreateContactInput,
    scoreResult: LeadScoreResult,
    notes?: string | null
  ): Promise<string> {
    const prompt = buildFollowUpPrompt(contact, scoreResult.score, scoreResult.reasoning, notes);
    const response = await chat(this.geminiClient, {
      messages: [{ role: "system", content: prompt }],
      temperature: 0.2,
      maxOutputTokens: 200
    });

    return response.trim();
  }

  private async updateContactScore(
    tenantId: string,
    contactId: string,
    score: number,
    reasoning: string
  ) {
    await scopedPrisma(tenantId).contact.updateMany({
      where: {
        id: contactId
      },
      data: {
        leadScore: score,
        leadScoreReason: reasoning
      }
    });
  }
}
