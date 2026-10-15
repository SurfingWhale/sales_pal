// Downscale an image file client-side before sending to the scan API (keeps payload small).
export function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const longest = Math.max(width, height);
      if (longest > maxDim) {
        const scale = maxDim / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas tidak didukung")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    img.src = url;
  });
}

// A logo for quote and invoice headers: kept as PNG so a transparent
// background stays transparent, small enough to live in the business doc.
export async function logoImage(file: File, maxDim = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("Gambar tidak bisa dibaca"));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak didukung");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    if (png.length <= 160_000) return png;
    const webp = canvas.toDataURL("image/webp", 0.9);
    if (webp.startsWith("data:image/webp") && webp.length <= 160_000) return webp;
    throw new Error("Logo kegedean. Pakai PNG yang lebih sederhana atau lebih kecil.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
