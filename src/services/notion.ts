import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { config, daysUntilYmd, NOTION_PROPS, TASK_STATUS } from "../config.js";

const notion = new Client({ auth: config.notion.apiKey });

export interface TaskRecord {
  pageId: string;
  title: string;
  assigneeId: string;
  dueDate: string | null;
  status: string | null;
}

function readTitle(page: PageObjectResponse): string {
  const prop = page.properties[NOTION_PROPS.title];
  if (!prop || prop.type !== "title") {
    return "";
  }
  return prop.title.map((item) => item.plain_text).join("").trim();
}

function readRichText(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (!prop || prop.type !== "rich_text") {
    return "";
  }
  return prop.rich_text.map((item) => item.plain_text).join("").trim();
}

function readDate(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (!prop || prop.type !== "date") {
    return null;
  }
  return prop.date?.start ?? null;
}

function readStatus(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (!prop || prop.type !== "status") {
    return null;
  }
  return prop.status?.name ?? null;
}

function toTask(page: PageObjectResponse): TaskRecord {
  return {
    pageId: page.id,
    title: readTitle(page),
    assigneeId: readRichText(page, NOTION_PROPS.assigneeId),
    dueDate: readDate(page, NOTION_PROPS.dueDate),
    status: readStatus(page, NOTION_PROPS.status),
  };
}

async function queryAll(filter: NonNullable<Parameters<typeof notion.databases.query>[0]["filter"]>): Promise<TaskRecord[]> {
  const tasks: TaskRecord[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: config.notion.databaseId,
      filter,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (isFullPage(page)) {
        tasks.push(toTask(page));
      }
    }

    startCursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (startCursor);

  return tasks;
}

export async function createTask(params: {
  title: string;
  assigneeId: string;
  dueDate: string;
}): Promise<TaskRecord> {
  const page = await notion.pages.create({
    parent: { database_id: config.notion.databaseId },
    properties: {
      [NOTION_PROPS.title]: {
        title: [{ type: "text", text: { content: params.title } }],
      },
      [NOTION_PROPS.assigneeId]: {
        rich_text: [{ type: "text", text: { content: params.assigneeId } }],
      },
      [NOTION_PROPS.dueDate]: {
        date: { start: params.dueDate },
      },
      [NOTION_PROPS.status]: {
        status: { name: TASK_STATUS.inProgress },
      },
    },
  });

  if (!isFullPage(page)) {
    throw new Error("노션 페이지 생성 응답이 올바르지 않습니다.");
  }

  return toTask(page);
}

export async function findTasksByTitle(title: string): Promise<TaskRecord[]> {
  return queryAll({
    property: NOTION_PROPS.title,
    title: { equals: title },
  });
}

export async function updateTaskDueDate(pageId: string, dueDate: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [NOTION_PROPS.dueDate]: {
        date: { start: dueDate },
      },
    },
  });
}

export async function findNearestInProgressTask(assigneeId: string): Promise<TaskRecord | null> {
  const tasks = await queryAll({
    and: [
      {
        property: NOTION_PROPS.assigneeId,
        rich_text: { equals: assigneeId },
      },
      {
        property: NOTION_PROPS.status,
        status: { equals: TASK_STATUS.inProgress },
      },
    ],
  });

  if (tasks.length === 0) {
    return null;
  }

  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) {
      return 0;
    }
    if (!a.dueDate) {
      return 1;
    }
    if (!b.dueDate) {
      return -1;
    }
    return daysUntilYmd(a.dueDate) - daysUntilYmd(b.dueDate);
  })[0] ?? null;
}

export async function markTaskDone(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [NOTION_PROPS.status]: {
        status: { name: TASK_STATUS.done },
      },
    },
  });
}

export async function listOpenTasks(): Promise<TaskRecord[]> {
  return queryAll({
    property: NOTION_PROPS.status,
    status: { does_not_equal: TASK_STATUS.done },
  });
}
