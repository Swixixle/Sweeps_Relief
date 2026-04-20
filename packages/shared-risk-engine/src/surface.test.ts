import { describe, expect, it } from "vitest";
import { classifySurface } from "./evaluate.js";
import type { FieldMetadata } from "./types.js";

describe("classifySurface", () => {
  it("classifies login_surface from login copy + password field", () => {
    const field: FieldMetadata = {
      type: "email",
      name: "email",
      id: "login-email",
      labelText: "Email",
      nearbyButtonText: "Log In",
      nearbyHeadingText: "Member Login",
      formAction: "/api/account/login",
    };
    const s = classifySurface(
      "http://127.0.0.1:8765/login_surface.html",
      "Login — Sweeps Account Access",
      field,
      "Sign in sweeps redeem wallet bonus cashout",
    );
    expect(s).toBe("login_surface");
  });

  it("classifies benign_form for search-style fields", () => {
    const s = classifySurface(
      "https://news.example/",
      "News",
      { name: "q", placeholder: "Search articles" },
      "",
    );
    expect(s).toBe("benign_form");
  });
});
