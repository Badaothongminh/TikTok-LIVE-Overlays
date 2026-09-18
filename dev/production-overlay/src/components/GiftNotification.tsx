import { useEffect, useState } from "react";

interface GiftNotificationProps {
  nickname: string;
  profileUrl: string;
  giftName: string;
  quantity: number;
  coinValue: number;
  onComplete: () => void;
  persistent?: boolean;
  fadeIn: number;
  fadeOut: number;
  displayTime: number;
  fontSize: number;
}

export function GiftNotification({
  nickname,
  profileUrl,
  giftName,
  quantity,
  coinValue,
  onComplete,
  persistent = false,
  fadeIn,
  fadeOut,
  displayTime,
  fontSize,
}: GiftNotificationProps) {
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

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            marginBottom: "6px",
            overflowWrap: "anywhere",
          }}
        >
          {nickname} sent {giftName} ×{quantity}
        </div>

        <div
          style={{
            fontSize: "17px",
          }}
        >
          🪙 {coinValue} Coin
        </div>
      </div>
    </div>
  );
}
