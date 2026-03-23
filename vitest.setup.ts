import { vi } from "vitest";
import React from "react";

vi.mock("lottie-react", () => ({
  default: vi.fn(({ animationData, lottieRef, loop, autoplay, ...props }) =>
    React.createElement("div", {
      "data-lottie-mock": "true",
      "data-animation-loaded": !!animationData,
      ...props,
    })
  ),
}));
