import { useEffect, useState } from "react";

interface CommentNotificationProps {
  nickname: string;
  profileUrl: string;
  comment: string;
  onComplete: () => void;
  persistent?: boolean;
  fadeIn: number;
  fadeOut: number;
  displayTime: number;
  fontSize: number;
}

export function CommentNotification({
  nickname,
  profileUrl,
  comment,
  onComplete,
  persistent = false,
  fadeIn,
  fadeOut,
  displayTime,
  fontSize,
}: CommentNotificationProps) {
  const [phase, setPhase] =
    useState<"fadein" | "display" | "fadeout">("fadein");

  useEffect(() => {
    if (persistent) {
      const displayTimer = setTimeout(() => {
        setPhase("display");
      }, fadeIn);

      return () => {
        clearTimeout(displayTimer);
      };
    }

    const displayTimer = setTimeout(() => {
      setPhase("display");
    }, fadeIn);

    const fadeOutTimer = setTimeout(() => {
      setPhase("fadeout");
    }, fadeIn + displayTime);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, fadeIn + displayTime + fadeOut);

    return () => {
      clearTimeout(displayTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [fadeIn, fadeOut, displayTime, onComplete, persistent]);

  return (
    <div
      data-phase={phase}
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "8px 10px",
        borderRadius: "10px",
        background: "rgba(0, 0, 0, 0.82)",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        opacity: phase === "fadein" ? 0 : phase === "fadeout" ? 0 : 1,
        transition:
          phase === "fadeout"
            ? `opacity ${fadeOut}ms ease`
            : `opacity ${fadeIn}ms ease`,
      }}
    >
      {profileUrl && (
        <img
          src={profileUrl}
          alt=""
          style={{
            width: "40px",
            height: "40px",
            flexShrink: 0,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      )}

      <div
        style={{
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: "2px",
            overflowWrap: "anywhere",
          }}
        >
          {nickname}
        </div>

        <div
          style={{
            fontSize: "18px",
            lineHeight: 1.2,
            overflowWrap: "anywhere",
          }}
        >
          {comment}
        </div>
      </div>
    </div>
  );
}
