import { storySegments } from "@/lib/story-text";

/** Renders a campaign story, turning `**words**` into bold. Line breaks come from CSS. */
export function StoryText({ text }: { text: string }) {
  return (
    <>
      {storySegments(text).map((segment, index) =>
        segment.bold ? <strong key={index}>{segment.text}</strong> : segment.text,
      )}
    </>
  );
}
