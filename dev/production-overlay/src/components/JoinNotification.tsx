import React, { useState, useEffect } from "react";

interface JoinNotificationProps {
  nickname: string;
  profileUrl: string;
  onComplete: () => void;
  persistent?: boolean;
  fadeIn: number;
  fadeOut: number;
  displayTime: number;
  fontSize: number;
  imageSize: number;
}

export function JoinNotification({
  nickname,
  profileUrl,
  onComplete,
  persistent = false,
  fadeIn,
  fadeOut,
  displayTime,
  fontSize,
  imageSize,
}: JoinNotificationProps) {
  const [phase, setPhase] = useState<"fadein" | "display" | "fadeout">("fadein");

  useEffect(() => {
    if (persistent) {
      const displayTimer = setTimeout(() => {
        setPhase("display");
      }, fadeIn);

      return () => {
        clearTimeout(displayTimer);
      };
    }

    // Fade in
    const displayTimer = setTimeout(() => {
      setPhase("display");
    }, fadeIn);

    // Start fade out
    const fadeOutTimer = setTimeout(() => {
      setPhase("fadeout");
    }, fadeIn + displayTime);

    // Complete
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
        alignItems: "center",
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
          fontSize: "20px",
          overflowWrap: "anywhere",
        }}
      >
        <strong>{nickname}</strong> joined
      </div>
    </div>
  );
}