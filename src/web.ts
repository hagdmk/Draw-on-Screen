// The tablet web app (iPad, Android tablets): the overlay canvas and the toolbar on one page,
// talking through the bridge's in-page bus, plus a photo to draw on and saving as an image.
import "./main";
import "./toolbar";
import { icons } from "./icons";

const BOARD_KEY = "draw-on-screen:board";

const board = document.querySelector<HTMLCanvasElement>("#board")!;
const photo = document.querySelector<HTMLImageElement>("#photo")!;
const photoInput = document.querySelector<HTMLInputElement>("#photo-input")!;
const actions = document.querySelector<HTMLElement>("#actions")!;

function actionButton(label: string, icon: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = "icon-button";
  el.title = label;
  el.setAttribute("aria-label", label);
  el.innerHTML = icon;
  el.addEventListener("click", onClick);
  actions.append(el);
  return el;
}

// Photo: tap to pick one to draw on, tap again to remove it.
const photoButton = actionButton("Add photo", icons.photo, () => {
  if (photo.hidden) photoInput.click();
  else setPhoto(null);
});

function setPhoto(file: File | null): void {
  if (photo.src) URL.revokeObjectURL(photo.src);
  photo.hidden = !file;
  if (file) photo.src = URL.createObjectURL(file);
  else photo.removeAttribute("src");
  photoButton.setAttribute("aria-pressed", String(Boolean(file)));
  photoButton.title = file ? "Remove photo" : "Add photo";
  photoButton.setAttribute("aria-label", photoButton.title);
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (file) setPhoto(file);
  photoInput.value = "";
});

actionButton("Save as image", icons.save, () => saveImage());

// Board color: white or dark, remembered between visits.
function setDarkBoard(dark: boolean): void {
  document.body.classList.toggle("dark-board", dark);
  try {
    localStorage.setItem(BOARD_KEY, dark ? "dark" : "light");
  } catch {
    // Not fatal: the choice just won't be remembered.
  }
}

let savedBoard: string | null = null;
try {
  savedBoard = localStorage.getItem(BOARD_KEY);
} catch {
  // Storage may be unavailable; start with the white board.
}
setDarkBoard(savedBoard === "dark");
actionButton("Board color", icons.board, () => setDarkBoard(!document.body.classList.contains("dark-board")));

/** Board color, photo and drawing flattened into one PNG at the screen's full resolution. */
function renderImage(): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = board.width;
  out.height = board.height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
  ctx.fillRect(0, 0, out.width, out.height);
  if (!photo.hidden && photo.naturalWidth > 0) {
    // Same placement as the on-screen photo (object-fit: contain).
    const scale = Math.min(out.width / photo.naturalWidth, out.height / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    ctx.drawImage(photo, (out.width - w) / 2, (out.height - h) / 2, w, h);
  }
  ctx.drawImage(board, 0, 0);
  return out;
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, base64] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: header.slice(5, header.indexOf(";")) });
}

function saveImage(): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const name = `drawing-${stamp}.png`;
  // Built synchronously so the share sheet still counts as a response to the tap (Safari).
  const dataUrl = renderImage().toDataURL("image/png");
  const file = dataUrlToFile(dataUrl, name);
  if (navigator.canShare?.({ files: [file] })) {
    // iPad and Android: the share sheet offers Save Image / Photos / Files.
    navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  link.click();
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("./sw.js").catch(() => {});
}
