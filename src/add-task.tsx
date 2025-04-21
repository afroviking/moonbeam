import { Action, ActionPanel, Form, Icon, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import { useForm } from "@raycast/utils";

interface Preferences {
  apiToken: string;
  areaId: string;
}

interface FormValues {
  name: string;
  description: string;
}

function getNextDayOfWeek(dayName: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  const today = new Date();
  const currentDay = today.getDay();
  
  // Calculate days until next occurrence
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // If the day has passed this week, get next week's date
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);
  return nextDate;
}

function parseNaturalDateTime(text: string): { title: string; date: Date | null } {
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const datePatterns = [
    // Relative days
    { regex: /\b(in\s+)?(\d+)\s+days?\b/i, handler: (match: RegExpMatchArray) => {
      const days = parseInt(match[2]);
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + days);
      return date;
    }},
    { regex: /\b(in\s+)?(\d+)\s+weeks?\b/i, handler: (match: RegExpMatchArray) => {
      const weeks = parseInt(match[2]);
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + (weeks * 7));
      return date;
    }},
    // Specific days
    { regex: /\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, 
      handler: (match: RegExpMatchArray) => getNextDayOfWeek(match[2])
    },
    // Month and day formats
    { regex: /\b(on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, 
      handler: (match: RegExpMatchArray) => {
        const day = parseInt(match[2]);
        const month = months[match[3].toLowerCase() as keyof typeof months];
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setMonth(month, day);
        // If the date is in the past, set it to next year
        if (date < new Date()) {
          date.setFullYear(date.getFullYear() + 1);
        }
        return date;
      }
    },
    { regex: /\b(on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const month = months[match[2].toLowerCase() as keyof typeof months];
        const day = parseInt(match[3]);
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setMonth(month, day);
        // If the date is in the past, set it to next year
        if (date < new Date()) {
          date.setFullYear(date.getFullYear() + 1);
        }
        return date;
      }
    },
    // Numeric month/day formats
    { regex: /\b(on\s+)?(\d{1,2})[/-](\d{1,2})\b/i,
      handler: (match: RegExpMatchArray) => {
        const day = parseInt(match[2]);
        const month = parseInt(match[3]) - 1; // JavaScript months are 0-based
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setMonth(month, day);
        // If the date is in the past, set it to next year
        if (date < new Date()) {
          date.setFullYear(date.getFullYear() + 1);
        }
        return date;
      }
    },
    // Common phrases
    { regex: /\btomorrow\b/i, handler: () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 1);
      return date;
    }},
    { regex: /\btoday\b/i, handler: () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      return date;
    }}
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const date = pattern.handler(match);
      const title = text.replace(pattern.regex, '').trim();
      return { title, date };
    }
  }

  return { title: text, date: null };
}

function generateSourceId(): string {
  const timestamp = Date.now().toString(36); // Convert to base36 for shorter string
  const random = Math.random().toString(36).substring(2, 8); // Get 6 random chars
  return `${timestamp}-${random}`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    if (!preferences.apiToken) {
      showToast({
        style: Toast.Style.Failure,
        title: "API Token Required",
        message: "Please set your Lunatask API token in the extension preferences",
      });
    }
  }, [preferences.apiToken]);

  const { handleSubmit, itemProps } = useForm<FormValues>({
    onSubmit: async (values) => {
      if (!preferences.apiToken) {
        await showToast({
          style: Toast.Style.Failure,
          title: "API Token Required",
          message: "Please set your Lunatask API token in the extension preferences",
        });
        return;
      }

      if (!preferences.areaId) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Area ID Required",
          message: "Please set your Lunatask Area ID in the extension preferences",
        });
        return;
      }

      if (!values.name) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Task Name Required",
          message: "Please enter a name for the task",
        });
        return;
      }

      try {
        const requestBody = {
          name: values.name,
          description: values.description || null,
          area_id: preferences.areaId,
          source: "raycast",
          source_id: generateSourceId(),
        };

        const response = await fetch("https://api.lunatask.app/v1/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${preferences.apiToken}`,
          },
          body: JSON.stringify(requestBody),
        });

        const responseData = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Invalid API token. Please check your token in the extension preferences.");
          }
          throw new Error(`Failed to create task: ${JSON.stringify(responseData)}`);
        }

        await showToast({
          style: Toast.Style.Success,
          title: "Task created successfully",
        });
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to create task",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
  });

  return (
    // @ts-ignore - Raycast API component type errors
    <Form
      actions={
        // @ts-ignore - Raycast API component type errors
        <ActionPanel>
          <Action.SubmitForm title="Add Task" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        title="Task Name"
        placeholder="Enter task name"
        {...itemProps.name}
      />
      <Form.TextArea
        title="Description"
        placeholder="Enter task description (optional)"
        {...itemProps.description}
      />
    </Form>
  );
} 