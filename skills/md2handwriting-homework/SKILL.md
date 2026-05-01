---
name: md2handwriting-homework
description: Produce Markdown homework solutions that are ready for the md2handwriting handwriting renderer. Use when the user provides problem images, textbook exercise screenshots, homework requirements, or asks for one or three handwritten-style Markdown versions with OCR, exact problem restatement, LaTeX math, page breaks, correction marks, ink marks, or red-pen corrections.
---

# md2handwriting Homework

Use this skill to turn problem images or homework instructions into Markdown that can be pasted directly into the md2handwriting renderer.

## Workflow

1. Read all provided images/files and transcribe the requested problems exactly. Preserve original problem numbers, wording, symbols, and subparts.
2. Before giving solution Markdown, show a short "题目识别核对" section outside the Markdown block. If any text is unclear, mark it as `[无法确认]` and ask for confirmation instead of guessing.
3. Unless the user explicitly asks for three versions now, output one fenced `md` block first. If the user confirms or asks for three versions, output three separate fenced `md` blocks with correct but naturally varied wording, layout, and handwriting marks.
4. Solve with complete but concise reasoning. Do not skip important algebra or proof steps.
5. Run the checklist below mentally before finalizing.

## Markdown Contract

Inside each fenced `md` block:

- Use plain text only. Do not use Markdown headings, bold, italic, unordered lists, blockquotes, links, images, or Markdown tables.
- Use plain numbering such as `1.解：`, `1.证：`, `(1)`, `(2)`. For proof problems, start with `x.证：`; for solution problems, start with `x.解：`.
- Put all mathematical variables, symbols, and formulas in LaTeX. Use `$...$` for inline math and `$$...$$` for display math.
- Typora-style math is allowed: `\vec{a}`, `\overline{a}`, `\hat{x}`, `|a|`, matrices, cases, aligned equations, Greek letters, sums, products, roots, and fractions.
- Keep short relations inline, for example `$0<|z|<1$`. Use display math or `aligned` only when a derivation is multi-step or too wide for one line.
- If a display derivation wraps, make the continuation start clearly at the next line, usually with `\begin{aligned}` and relation symbols at the beginning of the continuation line.
- Use `---` on a line by itself only between complete paragraphs/problems when a page break is useful, especially for answers over about 500 Chinese characters or with many formulas.

## Handwriting Marks

- Add handwriting realism only when it does not harm readability or correctness.
- For normal longer answers, add 1-3 correction marks and 1-2 `[ink]` marks. For very short answers, fewer or none is acceptable.
- Correction syntax is `~~wrong text~~correct text` or `~~$wrong$~~$correct$`. Never put `~~` inside a math formula such as `$x=~~5~~3$`.
- Put `[ink]` outside math and in natural places.
- If red correction is requested, use `\textcolor{red}{...}` in text. If math appears inside, keep it separately wrapped, for example `\textcolor{red}{改为 $x=2$}`. Do not write `$\textcolor{red}{...}$`.
- Do not invent a fake mistake that changes the final answer or makes the reasoning ambiguous.

## Three-Version Mode

When asked to output three handwritten homework Markdown versions:

- Keep the recognized problem list once before the three blocks.
- Label outside the fences as `版本一`, `版本二`, `版本三`.
- Each version must solve the same problems correctly, but vary phrasing, line breaks, derivation order, and optional handwriting marks.
- Keep all three compatible with the Markdown Contract.

## Checklist

- Problem statement was transcribed exactly or uncertainty was surfaced.
- No forbidden Markdown appears inside the answer block.
- All math is valid LaTeX and correction marks are outside math internals.
- Short relations remain inline; only genuinely long derivations are aligned or split.
- Page breaks are standalone `---` lines.
- The final answer is concise enough for a student-style handwritten submission.

For a reusable prompt for other AI systems, see `references/homework-md2handwriting-prompt.md` when available.
