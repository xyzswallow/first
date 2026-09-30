import { snapshotsRepo } from "@/server/db";
import { currentUser } from "@/server/currentUser";
import { accessForUser } from "@/server/access";
import { computeSheet, isFormula } from "@/lib/formula";
import ExcelJS from "exceljs";

// GET /api/export/[id] —— 表格导出为 xlsx
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;
  const user = await currentUser();
  const access = accessForUser(id, user, token);
  if (!access || !access.canRead) {
    return new Response("无权访问", { status: 403 });
  }
  if (access.doc.type !== "sheet") {
    return new Response("仅表格可导出", { status: 400 });
  }

  const raw = snapshotsRepo.get(id);
  let cells: Record<string, string> = {};
  let rows = 50;
  let cols = 26;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cells = parsed.cells ?? {};
      rows = parsed.rows ?? rows;
      cols = parsed.cols ?? cols;
    } catch {
      /* 空或异常快照，导出空表 */
    }
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  // 预先计算整张表的显示值，公式单元格导出其计算结果
  const display = computeSheet(cells);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}:${c}`;
      const raw = cells[key];
      if (raw === undefined || raw === "") continue;
      const cell = ws.getCell(r + 1, c + 1);
      if (isFormula(raw)) {
        // 公式单元格：保留公式并附带计算结果，Excel 打开后可见公式且显示结果
        const shown = display[key] ?? "";
        const num = Number(shown);
        const result = shown !== "" && !isNaN(num) ? num : shown;
        cell.value = {
          formula: raw.trimStart().slice(1),
          result,
        };
      } else {
        const num = Number(raw);
        cell.value = !isNaN(num) ? num : raw;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = encodeURIComponent(access.doc.name || "document") + ".xlsx";
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
