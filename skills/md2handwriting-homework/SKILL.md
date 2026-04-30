---
name: md2handwriting-homework
description: Produce Markdown homework solutions that are ready for the md2handwriting handwriting renderer. Use when the user provides problem images, textbook exercise screenshots, or homework requirements and wants OCR, exact problem restatement, concise solved answers, LaTeX math, page breaks, red corrections, ink marks, or natural handwriting-engine formatting.
---

# md2handwriting Homework

## Workflow

1. Identify every requested problem from the supplied image(s). Preserve the original problem number and transcribe the prompt exactly enough for the user to verify it.
2. Start the response with a short verification section listing the recognized problems. Do not solve yet if the image text is ambiguous; ask for a clearer crop or state the uncertain characters.
3. Output one fenced Markdown block for the first version. Only produce additional variants after the user confirms the recognized problems.
4. Keep the answer optimized for the renderer: plain text, numbered items, LaTeX math, sparse page breaks, and no decorative Markdown.

## Output Rules

- Do not use Markdown headings, bold, italic, tables, or unordered list markers inside the final fenced answer block.
- Use plain numbered labels such as `1.解：`, `2.证：`, `(1)`, `(2)`.
- Put all mathematical variables, symbols, units in formulas when practical. Use `$...$` for inline math and `$$...$$` for displayed derivations.
- Use `---` alone on a line only for intentional page/segment breaks. Prefer breaks between complete subproblems or major derivation stages.
- Keep explanations concise and in a normal university-student solution style.
- Avoid unsupported or sloppy syntax. Do not put `~~` inside `$...$`; write `$x = $~~$5$~~$3$`, not `$x=~~5~~3$`.

## Handwriting Marks

- Add 1-3 natural corrections with `~~...~~` only when the solution is long enough that this feels plausible.
- Add 1-2 `[ink]` markers in low-risk positions such as after punctuation or near a completed conclusion.
- Use red correction only when requested or pedagogically appropriate: `\textcolor{red}{改为 $x=2$}`. Do not wrap the entire color command inside `$...$`.
- Do not force mistakes into short answers where they would look distracting.

## Math Compatibility

- Prefer standard LaTeX. The renderer supports accents and delimiters, so use `\vec{a}`, `\overline{a}`, `\hat{x}`, `\tilde{x}`, `|a|`, matrices, cases, aligned equations, and Greek letters normally.
- For relation chains, use readable derivations. Either write separate displayed aligned lines or let the renderer format simple chains:
  `$$a=b=c=d$$`
- Do not write a dollar sign immediately followed by `=`. If a correction begins with an equality, write `$ = ...` or include the left side.

## Final Shape

Before finalizing, check:

- recognized problem statements are listed outside the answer block;
- every requested problem has an answer;
- formula delimiters are balanced;
- corrections and ink markers are syntactically outside math;
- page breaks are intentional and not excessive.
