import type { Page, Browser } from "playwright";

type Playwright = Awaited<ReturnType<typeof getPlaywright>>;

class ShaderValidator {
  playwright: Playwright;
  browser?: Browser;
  page?: Page;

  constructor(playwright: Playwright) {
    this.playwright = playwright;
  }

  async getPage() {
    if (!this.page) {
      this.browser = await this.playwright.chromium.launch({
        args: ["--enable-gpu"]
      });
      this.page = await this.browser.newPage();
    }

    return this.page;
  }

  async validate(shaderCode: string, shaderType: "fragment" | "vertex") {
    const page = await this.getPage();

    const result = await page.evaluate(([code, type]) => {
      const canvas = new OffscreenCanvas(1, 1);
      const gl = canvas.getContext("webgl2")!;

      const shader = gl.createShader(type === "fragment" ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      
      return gl.getShaderInfoLog(shader);
    }, [shaderCode, shaderType]);

    return result ?? "";

  }

  async close() {
    await this.browser?.close();
  }
}

async function getPlaywright() {
  return await import("playwright");
}

export async function getShaderValidator() {
  try {
    return new ShaderValidator(await import("playwright"));
  } catch {
    return undefined;
  }
}