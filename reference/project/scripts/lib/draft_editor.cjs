const baseConfig = require("../../config");

const TITLE_SETTLE_MS = 250;
const TEXT_BLOCK_SETTLE_MS = 120;
const IMAGE_BLOCK_SETTLE_MS = 220;
const SAVE_SETTLE_MS = 1400;
const EDITOR_FOCUS_SETTLE_MS = 120;
const IMAGE_DIALOG_SETTLE_MS = 250;
const IMAGE_UPLOAD_SETTLE_MS = 450;

async function insertTextFast(page, text) {
  const normalized = String(text || "");
  if (!normalized) return;

  try {
    await page.keyboard.insertText(normalized);
  } catch {
    await page.keyboard.type(normalized, { delay: 8 });
  }
}

function normalizeBlocks(contentOrBlocks) {
  if (Array.isArray(contentOrBlocks)) return contentOrBlocks;
  return [{ type: "text", text: String(contentOrBlocks || "") }];
}

async function postToBlog(page, title, content, saveOnly = false, options = {}) {
  return postRichToBlog(
    page,
    {
      title,
      blocks: normalizeBlocks(content),
    },
    saveOnly,
    options,
  );
}

async function postRichToBlog(page, post, saveOnly = true, options = {}) {
  require('./blog_presentation_policy.cjs').assertPresentationPolicy(post.title || '', post.blocks || []);
  if (saveOnly !== true) throw new Error("Restored editor is temporary-save only");
  const writeUrl = options.writeUrl || baseConfig.WRITE_URL;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const continueDraft = Boolean(options.continueDraft);
  const overwriteDraft = Boolean(options.overwriteDraft);
  if (!writeUrl) {
    throw new Error("Write URL is not configured.");
  }

  console.log("[blog] opening write page...");
  const activePage = (options.reviewExisting || options.useOpenEditor) ? page : await openWritePage(page, writeUrl);

  const editor = await getEditorContext(activePage);
  console.log(`[blog] editor context ready: ${editor.label} / ${editor.context.url().slice(0, 90)}`);

  if (!options.reviewExisting) {
  await waitForEditorReady(editor.context, activePage);
  if (!options.useOpenEditor) await handleDraftPopup(editor.context, activePage, { continueDraft });
  await dismissGuideOverlay(editor.context);
  if ((continueDraft && overwriteDraft) || options.useOpenEditor) {
    console.log("[blog] clearing existing draft body...");
    await clearEditorBody(editor.context, activePage);
  }
  if (onProgress) {
    await onProgress({
      stage: "editor_writing",
      blockCount: post.blocks.length,
      imageCount: post.blocks.filter((block) => block.type === "image").length,
    });
  }

  console.log("[blog] typing title...");
  await inputTitle(editor.context, activePage, post.title);
  await activePage.waitForTimeout(TITLE_SETTLE_MS);

  console.log(`[blog] writing ${post.blocks.length} content blocks...`);
  for (const block of post.blocks) {
    if (block.type === "image") {
      await uploadImageBlock(editor.context, activePage, block.path);
    } else if (block.type === "heading") {
      await inputHeadingBlock(editor.context, activePage, block);
    } else {
      await inputTextBlock(editor.context, activePage, block);
    }
    await activePage.waitForTimeout(block.type === "image" ? IMAGE_BLOCK_SETTLE_MS : TEXT_BLOCK_SETTLE_MS);
  }

  }
  if (saveOnly) {
    console.log("[blog] saving draft...");
    if (onProgress) {
      await onProgress({ stage: "draft_saving" });
    }
    await clickSave(editor.context);
    await activePage.waitForTimeout(SAVE_SETTLE_MS);
    console.log("[blog] draft saved.");
    if (onProgress) {
      await onProgress({ stage: "draft_saved" });
    }
    return null;
  }

  console.log("[blog] publishing...");
  if (typeof options.confirmPublish !== "function") {
    throw new Error("Publishing requires an explicit confirmation callback.");
  }
  await options.confirmPublish({ title: post.title, writeUrl });
  await clickPublish(editor.context, activePage);
  await activePage.waitForTimeout(4000);

  const postUrl = activePage.url();
  console.log("[blog] post url:", postUrl);
  if (onProgress) {
    await onProgress({ stage: "publish_completed", postUrl });
  }
  return postUrl;
}

async function openWritePage(page, writeUrl) {
  const context = page.context();
  const knownPages = new Set(context.pages());
  let activePage = page;

  try {
    await page.goto(writeUrl, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (!page.isClosed()) {
      throw error;
    }
  }

  // Naver can move the editor into a newly opened page/tab.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const candidate = context
    .pages()
    .filter((item) => !item.isClosed())
    .find((item) => !knownPages.has(item));
  if (candidate) {
    activePage = candidate;
  }

  if (activePage.isClosed()) {
    const openPages = context.pages().filter((item) => !item.isClosed());
    activePage = openPages[openPages.length - 1];
  }

  if (!activePage || activePage.isClosed()) {
    throw new Error("Write page could not be opened because the active page was closed.");
  }

  await activePage.bringToFront().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return activePage;
}

async function getEditorContext(page) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (isLoginUrl(page.url())) {
      throw new Error(`Write page redirected to login: ${page.url()}`);
    }

    const candidates = buildContextCandidates(page);
    for (const candidate of candidates) {
      const ready = await looksLikeEditor(candidate.context);
      if (ready) {
        return candidate;
      }
    }

    await page.waitForTimeout(1000);
  }

  const frameSummary = page
    .frames()
    .map((frame) => `${frame.name() || "(unnamed)"}:${frame.url()}`)
    .join(" | ");

  throw new Error(`Editor context was not found. url=${page.url()} frames=${frameSummary}`);
}

function buildContextCandidates(page) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (label, context) => {
    const key = `${label}:${context.url()}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ label, context });
  };

  const namedMainFrame = page.frame({ name: "mainFrame" });
  if (namedMainFrame) {
    pushCandidate("mainFrame", namedMainFrame);
  }

  for (const frame of page.frames()) {
    if (frame === namedMainFrame) continue;
    pushCandidate(frame.name() || "frame", frame);
  }

  pushCandidate("page", page);
  return candidates;
}

async function looksLikeEditor(context) {
  return context
    .evaluate(() =>
      Boolean(
        document.querySelector(".se-title-text") ||
          document.querySelector(".se-text-paragraph") ||
          document.querySelector(".se-main-container"),
      ),
    )
    .catch(() => false);
}

async function waitForEditorReady(context, page) {
  console.log("[blog] waiting for editor...");
  for (let t = 0; t < 25; t += 1) {
    const ready = await looksLikeEditor(context);
    if (ready) {
      console.log(`[blog] editor became interactive after ${t + 1}s`);
      await page.waitForTimeout(1000);
      return;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Editor did not become ready in time. current url=${context.url()}`);
}

async function handleDraftPopup(context, page, options = {}) {
  const continueDraft = Boolean(options.continueDraft);
  try {
    const popup = await context.$(".se-popup-alert-confirm, .se-popup.se-popup-alert");
    if (!popup) return;

    const text = await popup.innerText().catch(() => "");
    console.log("[blog] draft popup detected:", text.replace(/\n/g, " ").slice(0, 80));

    const confirmButton = await context.$(".se-popup-button-confirm");
    if (continueDraft && confirmButton) {
      await confirmButton.click();
      await page.waitForTimeout(1500);
      return;
    }

    const cancelButton = await context.$(".se-popup-button-cancel");
    if (cancelButton) {
      await cancelButton.click();
      await page.waitForTimeout(1500);
      return;
    }

    if (confirmButton) {
      await confirmButton.click();
      await page.waitForTimeout(1500);
    }
  } catch (error) {
    console.log("[blog] ignored popup handling error:", error.message.slice(0, 60));
  }
}

async function dismissGuideOverlay(context) {
  try {
    await context.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a"));
      const closeButton = buttons.find((button) => {
        const text = (button.innerText || "").trim();
        return text === "닫기" || text === "시작하기";
      });
      if (closeButton) closeButton.click();
    });
  } catch {
    // ignore
  }
}

async function inputTitle(context, page, title) {
  const selectors = [".se-title-text", "div[class*='se-title-text']", ".se-module-text.se-title-text"];

  for (const selector of selectors) {
    try {
      const handle = await context.$(selector);
      if (!handle) continue;

      await handle.click();
      await page.waitForTimeout(180);
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(50);
      await insertTextFast(page, title);
      const actualTitle = await handle.innerText();
      if (actualTitle.trim() !== title) throw new Error("Title replacement failed");
      await page.keyboard.press("Enter");
      console.log(`[blog] title typed with selector ${selector}`);
      return;
    } catch {
      // try next selector
    }
  }

  throw new Error("Could not find the title input area.");
}

async function inputHeadingBlock(context, page, text) {
  const block = typeof text === "string" ? { text } : text || {};
  const rawText = String(block.text || "");
  if (!rawText.trim()) return;

  await focusEditorEnd(context, page);
  if (block.prependBlankLine) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(35);
  }
  await applyParagraphPreset(context, {
    textFormat: "sectionTitle",
    fontSize: "fs24",
    bold: true,
    align: block.align || "center",
  });

  await insertTextFast(page, rawText.trim());
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(40);
  console.log("[blog] heading block inserted.");
}

async function inputTextBlock(context, page, text) {
  const block = typeof text === "string" ? { text } : text || {};
  const rawText = String(block.text || "");
  if (!rawText.trim()) return;

  await focusEditorEnd(context, page);
  if (block.prependBlankLine) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(35);
  }
  await applyParagraphPreset(context, {
    textFormat: "text",
    fontSize: "fs16",
    bold: false,
    align: block.align || "center",
  });

  const paragraphs = buildDisplayParagraphs(rawText, block);

  for (const paragraph of paragraphs) {
    const lines = Array.isArray(paragraph)
      ? paragraph.map((line) => String(line || "").trim()).filter(Boolean)
      : String(paragraph)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

    for (let i = 0; i < lines.length; i += 1) {
      await insertTextFast(page, lines[i]);
      if (i < lines.length - 1) {
        await page.keyboard.press("Shift+Enter");
        await page.waitForTimeout(15);
      }
    }

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(30);
  }

  console.log("[blog] text block inserted.");
}

function buildDisplayParagraphs(text, block = {}) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  if (isTagStyleBlock(block, normalized)) {
    return [[normalized]];
  }

  const paragraphSources = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) =>
      splitIntoSentenceParagraphsSafe(
        paragraph.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
        block.maxSentencesPerParagraph || 2,
      ),
    );

  const maxCharsPerLine = Number(block.maxCharsPerLine);

  return paragraphSources.map((paragraph) => {
    const compact = paragraph.replace(/\s+/g, " ").trim();
    if (Number.isFinite(maxCharsPerLine) && maxCharsPerLine > 0) {
      const wrapped = wrapParagraphByMaxChars(compact, maxCharsPerLine);
      return wrapped.length ? wrapped : [compact];
    }
    return [compact];
  });
}

function wrapParagraphByMaxChars(paragraph, maxChars = 50) {
  const normalized = String(paragraph || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const lines = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    let cutIndex = maxChars;
    const window = remaining.slice(0, maxChars + 1);
    const minSplitIndex = Math.floor(maxChars * 0.45);
    const spaceIndex = window.lastIndexOf(" ");
    const punctuationIndex = Math.max(
      window.lastIndexOf(", "),
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );

    if (punctuationIndex >= minSplitIndex) {
      cutIndex = punctuationIndex + 1;
    } else if (spaceIndex >= minSplitIndex) {
      cutIndex = spaceIndex;
    }

    const line = remaining.slice(0, cutIndex).trim();
    if (line) lines.push(line);
    remaining = remaining.slice(cutIndex).trimStart();
  }

  if (remaining) lines.push(remaining);
  return lines;
}

function isTagStyleBlock(block, text) {
  if (block.blockRole === "tags") return true;
  return /^#\S+(?:\s+#\S+)+$/.test(String(text || "").trim());
}

function wrapParagraphForDisplay(paragraph, targetLength = 28) {
  const rawLines = String(paragraph)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const wrapped = [];

  rawLines.forEach((line) => {
    const pieces = splitDisplayPieces(line);
    pieces.forEach((piece) => {
      wrapped.push(...wrapDisplayLine(piece, targetLength));
    });
  });

  return wrapped.filter(Boolean);
}

function splitIntoSentenceParagraphs(paragraph, maxSentencesPerParagraph = 2) {
  const normalized = String(paragraph || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?]|[다요죠니다까])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentencesPerParagraph) {
    return [normalized];
  }

  const chunks = [];
  for (let i = 0; i < sentences.length; i += maxSentencesPerParagraph) {
    chunks.push(sentences.slice(i, i + maxSentencesPerParagraph).join(" "));
  }

  return chunks;
}

function splitIntoSentenceParagraphsSafe(paragraph, maxSentencesPerParagraph = 2) {
  const normalized = String(paragraph || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length || sentences.length <= maxSentencesPerParagraph) {
    return [normalized];
  }

  const chunks = [];
  for (let i = 0; i < sentences.length; i += maxSentencesPerParagraph) {
    chunks.push(sentences.slice(i, i + maxSentencesPerParagraph).join(" "));
  }

  return chunks;
}

function splitIntoSentenceParagraphsAscii(paragraph, maxSentencesPerParagraph = 2) {
  const normalized = String(paragraph || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length || sentences.length <= maxSentencesPerParagraph) {
    return [normalized];
  }

  const chunks = [];
  for (let i = 0; i < sentences.length; i += maxSentencesPerParagraph) {
    chunks.push(sentences.slice(i, i + maxSentencesPerParagraph).join(" "));
  }

  return chunks;
}

function splitDisplayPieces(line) {
  const normalized = String(line || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const pieces = normalized
    .split(/(?<=[.!?])\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  return pieces.length ? pieces : [normalized];
}

function wrapDisplayLine(line, targetLength = 28) {
  const words = String(line || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= targetLength) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

async function focusEditorEnd(context, page) {
  const last = context.locator('.se-text-paragraph').last();
  await last.scrollIntoViewIfNeeded();
  await last.click({force:true});
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await page.waitForTimeout(180);
}

async function clearEditorBody(context, page) {
  await focusEditorEnd(context, page);
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+A`);
  await page.waitForTimeout(120);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(120);
  await page.keyboard.press("Backspace").catch(() => {});
  await page.waitForTimeout(600);
}

async function applyParagraphPreset(context, preset) {
  await setAlignment(context, preset.align || "left");
  await setTextFormat(context, preset.textFormat || "text");
  await setFontSize(context, preset.fontSize || "fs16");
  await setBold(context, Boolean(preset.bold));
}

async function setTextFormat(context, value) {
  await context.evaluate((targetValue) => {
    const selected = document.querySelector(
      `button[data-name="text-format"][data-value="${targetValue}"].se-is-selected`,
    );
    if (selected) return;

    const button = document.querySelector("button.se-text-format-toolbar-button");
    if (!button) return;
    button.click();

    const option = document.querySelector(`button[data-name="text-format"][data-value="${targetValue}"]`);
    if (option) option.click();
  }, value);
}

async function setFontSize(context, value) {
  await context.evaluate((targetValue) => {
    const selected = document.querySelector(
      `button[data-name="font-size"][data-value="${targetValue}"].se-is-selected`,
    );
    if (selected) return;

    const button = document.querySelector("button.se-font-size-code-toolbar-button");
    if (!button) return;
    button.click();

    const option = document.querySelector(`button[data-name="font-size"][data-value="${targetValue}"]`);
    if (option) option.click();
  }, value);
}

async function setBold(context, enabled) {
  await context.evaluate((shouldEnable) => {
    const button = document.querySelector("button.se-bold-toolbar-button");
    if (!button) return;
    const isSelected = button.classList.contains("se-is-selected");
    if (isSelected !== shouldEnable) button.click();
  }, enabled);
}

async function setAlignment(context, value) {
  await context.evaluate((targetValue) => {
    const selected = document.querySelector(
      `button[data-name="align-drop-down-with-justify"][data-value="${targetValue}"].se-is-selected`,
    );
    if (selected) return;

    const button = document.querySelector('button[data-name="align-drop-down-with-justify"]');
    if (!button) return;
    button.click();

    const option = document.querySelector(
      `button[data-name="align-drop-down-with-justify"][data-value="${targetValue}"]`,
    );
    if (option) option.click();
  }, value);
}

async function uploadImageBlock(context, page, imagePath) {
  console.log(`[blog] uploading image: ${imagePath}`);
  const beforeCount = await getInsertedImageCount(context);

  const opened = await context.evaluate(() => {
    const button =
      document.querySelector(".se-image-toolbar-button") ||
      document.querySelector("button[class*='image-toolbar-button']");
    if (!button) return false;
    button.click();
    return true;
  });

  if (!opened) {
    throw new Error("Could not find the image upload button.");
  }

  await page.waitForTimeout(IMAGE_DIALOG_SETTLE_MS);
  const fileInput = await context.$("#hidden-file, input[type='file']");
  if (!fileInput) {
    throw new Error("Could not find the hidden image file input.");
  }

  await fileInput.setInputFiles(imagePath);
  await waitForImageUpload(context, beforeCount);
  await page.waitForTimeout(IMAGE_UPLOAD_SETTLE_MS);
  console.log("[blog] image uploaded.");
}

async function getInsertedImageCount(context) {
  return context.evaluate(() => {
    const selectors = [
      ".se-module-image",
      ".se-image-resource",
      ".se-component-content img",
      "img[data-lazy-src]",
      "img[src*='blogfiles']",
    ];
    const all = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    return new Set(all).size;
  });
}

async function waitForImageUpload(context, beforeCount) {
  for (let i = 0; i < 45; i += 1) {
    const current = await getInsertedImageCount(context);
    if (current > beforeCount) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("[blog] upload completion was not confirmed, continuing.");
}

async function clickSave(context) {
  const result = await context
    .evaluate(() => {
      const button =
        document.querySelector("[data-click-area='tpb.save']") ||
        document.querySelector("button[class*='save_btn']");
      if (!button) return null;
      button.click();
      return button.className || "save";
    })
    .catch(() => null);

  if (result) {
    console.log("[blog] save button clicked:", result.slice(0, 50));
  } else {
    console.log("[blog] save button not found.");
  }
}

async function clickPublish(context, page) {
  const hasDim = await context.evaluate(() => Boolean(document.querySelector(".se-popup-dim")));
  if (hasDim) {
    await handleDraftPopup(context, page);
    await page.waitForTimeout(1000);
  }

  const clicked = await context
    .evaluate(() => {
      let button = document.querySelector("button[data-click-area='tpb.publish']");
      if (button) {
        button.click();
        return "data-click-area";
      }

      button = document.querySelector("button[class*='publish_btn']");
      if (button) {
        button.click();
        return "class";
      }

      const match = Array.from(document.querySelectorAll("button")).find((item) => {
        const text = (item.innerText || "").trim();
        return text === "발행" && !String(item.className || "").includes("reserve");
      });

      if (match) {
        match.click();
        return "text";
      }

      return null;
    })
    .catch(() => null);

  if (!clicked) {
    throw new Error("Could not find the publish button.");
  }

  await page.waitForTimeout(2500);
  await handlePublishPanel(context, page);
}

async function handlePublishPanel(context, page) {
  const result = await context
    .evaluate(() => {
      let button = document.querySelector("[data-click-area='tpb*i.publish']");
      if (button) {
        button.click();
        return "tpb*i.publish";
      }

      button = document.querySelector("button[class*='confirm_btn']");
      if (button) {
        button.click();
        return "confirm_btn";
      }

      const fallback = Array.from(document.querySelectorAll("button")).find((item) => {
        const text = (item.innerText || "").trim();
        const className = String(item.className || "");
        return (
          text === "발행" &&
          (className.includes("confirm") || className.includes("publish")) &&
          !className.includes("reserve")
        );
      });

      if (fallback) {
        fallback.click();
        return "fallback";
      }

      return null;
    })
    .catch(() => null);

  if (result) {
    console.log("[blog] publish confirmed:", result);
    await page.waitForTimeout(3000);
  } else {
    console.log("[blog] publish confirmation button not found.");
  }
}

function isLoginUrl(url = "") {
  return /nidlogin|login/i.test(String(url));
}

module.exports = {
  postRichToBlog,
  postToBlog,
};
