import { emphasizeSegments } from "@/lib/emphasized-text";

export function EmphasizedText({
  text,
  bold,
}: {
  text: string;
  bold?: string | null;
}) {
  return (
    <>
      {emphasizeSegments(text, bold).map((part, index) =>
        part.bold ? <strong key={index}>{part.text}</strong> : part.text,
      )}
    </>
  );
}
