import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/app-context";

export const { GET, POST } = toNextJsHandler(auth);
