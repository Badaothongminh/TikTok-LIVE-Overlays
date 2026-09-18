import { useCallback, useEffect, useRef, useState } from "react";
import type { OverlayContext } from "@eulerstream/overlay-sdk";
import {
  useWebcastChatMessage,
  useWebcastGiftMessage,
  useWebcastLikeMessage,
  useWebcastMemberMessage,
  useWebcastSocialMessage,
} from "@eulerstream/overlay-sdk";
import { CommentNotification } from "./components/CommentNotification";
import { FiveColumnLayout } from "./components/FiveColumnLayout";
import { FollowNotification } from "./components/FollowNotification";
import { GiftNotification } from "./components/GiftNotification";
import { JoinNotification } from "./components/JoinNotification";
import { LikeNotification } from "./components/LikeNotification";

interface JoinEvent {
  id: string;
  nickname: string;
  profileUrl: string;
}

interface CommentEvent {
  id: string;
  nickname: string;
  profileUrl: string;
  comment: string;
}

interface LikeEvent {
  id: string;
  nickname: string;
  profileUrl: string;
  likeCount: number;
}

interface FollowEvent {
  id: string;
  nickname: string;
  profileUrl: string;
}

interface GiftEvent {
  id: string;
  groupId: string;
  nickname: string;
  profileUrl: string;
  giftName: string;
  quantity: number;
  coinValue: number;
  finalized: boolean;
}

interface SocialRuntimeMetadata {
  common?: {
    displayText?: {
      displayType?: string;
    };
  };
}

interface GiftRuntimeMetadata {
  groupId?: string;
}

const GIFT_SEQUENCE_RETENTION_MS = 60_000;
function appendToFeed<T>(feed: T[], event: T): T[] {
  return [...feed, event];
}

export function Overlay({ config }: OverlayContext) {
  const fadeIn = (config.fadeIn as number) || 500;
  const fadeOut = (config.fadeOut as number) || 500;
  const displayTime = (config.displayTime as number) || 3000;
  const fontSize = (config.fontSize as number) || 48;
  const imageSize = (config.imageSize as number) || 200;

  const [joinFeed, setJoinFeed] = useState<JoinEvent[]>([]);

  const [commentFeed, setCommentFeed] = useState<CommentEvent[]>([]);

  const [likeFeed, setLikeFeed] = useState<LikeEvent[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalFollows, setTotalFollows] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);

  const [followFeed, setFollowFeed] = useState<FollowEvent[]>([]);

  const [giftFeed, setGiftFeed] = useState<GiftEvent[]>([]);

  const giftSequenceRef = useRef<Map<string, GiftEvent>>(new Map());
  const giftCleanupTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const memberMessage = useWebcastMemberMessage();
  const chatMessage = useWebcastChatMessage();
  const likeMessage = useWebcastLikeMessage();
  const socialMessage = useWebcastSocialMessage();
  const giftMessage = useWebcastGiftMessage();

  useEffect(() => {
    if (!memberMessage?.user) return;

    const user = memberMessage.user;
    const profilePicUrl = user.profilePicture?.url;
    const profileUrl = Array.isArray(profilePicUrl)
      ? profilePicUrl[0]
      : profilePicUrl || "";

    const joinEvent: JoinEvent = {
      id: `${user.userId}-${Date.now()}`,
      nickname: user.nickname || user.uniqueId || "Anonymous",
      profileUrl,
    };

    setJoinFeed((feed) => appendToFeed(feed, joinEvent));
  }, [memberMessage]);

  useEffect(() => {
    if (!chatMessage?.user || !chatMessage.comment) return;

    const user = chatMessage.user;
    const profilePicUrl = user.profilePicture?.url;
    const profileUrl = Array.isArray(profilePicUrl)
      ? profilePicUrl[0]
      : profilePicUrl || "";

    const commentEvent: CommentEvent = {
      id: `${user.userId}-${Date.now()}`,
      nickname: user.nickname || user.uniqueId || "Anonymous",
      profileUrl,
      comment: chatMessage.comment,
    };

    setCommentFeed((feed) => appendToFeed(feed, commentEvent));
  }, [chatMessage]);

  useEffect(() => {
    if (!likeMessage?.user || likeMessage.likeCount <= 0) return;

    const user = likeMessage.user;
    const profilePicUrl = user.profilePicture?.url;
    const profileUrl = Array.isArray(profilePicUrl)
      ? profilePicUrl[0]
      : profilePicUrl || "";

    const likeEvent: LikeEvent = {
      id: `${user.userId}-${Date.now()}`,
      nickname: user.nickname || user.uniqueId || "Anonymous",
      profileUrl,
      likeCount: likeMessage.likeCount,
    };

    setLikeFeed((feed) => appendToFeed(feed, likeEvent));
    setTotalLikes((total) => total + likeMessage.likeCount);
  }, [likeMessage]);

  useEffect(() => {
    if (!socialMessage?.user) return;

    const runtimeMessage =
      socialMessage as typeof socialMessage & SocialRuntimeMetadata;

    if (
      runtimeMessage.common?.displayText?.displayType !==
      "pm_main_follow_message_viewer_2"
    ) {
      return;
    }

    const user = socialMessage.user;
    const profilePicUrl = user.profilePicture?.url;
    const profileUrl = Array.isArray(profilePicUrl)
      ? profilePicUrl[0]
      : profilePicUrl || "";

    const followEvent: FollowEvent = {
      id: `${user.userId}-${Date.now()}`,
      nickname: user.nickname || user.uniqueId || "Anonymous",
      profileUrl,
    };

    setFollowFeed((feed) => appendToFeed(feed, followEvent));
    setTotalFollows((total) => total + 1);
  }, [socialMessage]);

  useEffect(() => {
    if (!giftMessage?.user || !giftMessage.giftDetails) return;

    const user = giftMessage.user;
    const giftDetails = giftMessage.giftDetails;
    const runtimeMessage =
      giftMessage as typeof giftMessage & GiftRuntimeMetadata;

    const quantity = giftMessage.repeatCount || 1;
    const finalized = giftMessage.repeatEnd === 1;

    const profilePicUrl = user.profilePicture?.url;
    const profileUrl = Array.isArray(profilePicUrl)
      ? profilePicUrl[0]
      : profilePicUrl || "";

    if (!giftDetails.combo) {
      const messageId =
        giftMessage.common?.msgId ||
        `${user.userId}-${giftMessage.giftId}-${Date.now()}`;

      const giftEvent: GiftEvent = {
        id: messageId,
        groupId: messageId,
        nickname: user.nickname || user.uniqueId || "Anonymous",
        profileUrl,
        giftName: giftDetails.giftName || "Gift",
        quantity,
        coinValue: giftDetails.diamondCount,
        finalized,
      };

      setGiftFeed((feed) => appendToFeed(feed, giftEvent));

      setTotalCoins(

        (total) => total + quantity * giftDetails.diamondCount

      );
      return;
    }

    const groupId =
      runtimeMessage.groupId ||
      giftMessage.common?.msgId ||
      `${user.userId}-${giftMessage.giftId}-${Date.now()}`;

    const updateGift = (gift: GiftEvent): GiftEvent =>
      gift.groupId === groupId
        ? {
            ...gift,
            quantity: Math.max(gift.quantity, quantity),
            finalized: gift.finalized || finalized,
          }
        : gift;

    const existingGift = giftSequenceRef.current.get(groupId);

    if (existingGift) {
      const updatedGift = updateGift(existingGift);
      const quantityDelta = Math.max(
        0,
        updatedGift.quantity - existingGift.quantity
      );
      giftSequenceRef.current.set(groupId, updatedGift);

      setGiftFeed((feed) => feed.map(updateGift));


      if (quantityDelta > 0) {

        setTotalCoins(

          (total) => total + quantityDelta * giftDetails.diamondCount

        );

      }

      if (updatedGift.finalized) {
        const existingTimer = giftCleanupTimerRef.current.get(groupId);

        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const cleanupTimer = setTimeout(() => {
          const retainedGift = giftSequenceRef.current.get(groupId);

          if (retainedGift?.finalized) {
            giftSequenceRef.current.delete(groupId);
          }

          giftCleanupTimerRef.current.delete(groupId);
        }, GIFT_SEQUENCE_RETENTION_MS);

        giftCleanupTimerRef.current.set(groupId, cleanupTimer);
      }

      return;
    }

    const giftEvent: GiftEvent = {
      id: groupId,
      groupId,
      nickname: user.nickname || user.uniqueId || "Anonymous",
      profileUrl,
      giftName: giftDetails.giftName || "Gift",
      quantity,
      coinValue: giftDetails.diamondCount,
      finalized,
    };

    giftSequenceRef.current.set(groupId, giftEvent);
    setGiftFeed((feed) => appendToFeed(feed, giftEvent));
    setTotalCoins(
      (total) => total + quantity * giftDetails.diamondCount
    );

    if (giftEvent.finalized) {
      const cleanupTimer = setTimeout(() => {
        const retainedGift = giftSequenceRef.current.get(groupId);

        if (retainedGift?.finalized) {
          giftSequenceRef.current.delete(groupId);
        }

        giftCleanupTimerRef.current.delete(groupId);
      }, GIFT_SEQUENCE_RETENTION_MS);

      giftCleanupTimerRef.current.set(groupId, cleanupTimer);
    }
  }, [giftMessage]);

  useEffect(() => {
    const cleanupTimers = giftCleanupTimerRef.current;

    return () => {
      for (const timer of cleanupTimers.values()) {
        clearTimeout(timer);
      }

      cleanupTimers.clear();
      giftSequenceRef.current.clear();
    };
  }, []);

  const handlePersistentComplete = useCallback(() => {}, []);


  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <FiveColumnLayout
        likeTotal={totalLikes}
        followTotal={totalFollows}
        giftTotal={totalCoins}
        join={
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: "6px",
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {[...joinFeed].reverse().map((event) => (
              <div key={event.id} style={{ flexShrink: 0 }}>
                <JoinNotification
                  nickname={event.nickname}
                  profileUrl={event.profileUrl}
                  onComplete={handlePersistentComplete}
                  persistent
                  fadeIn={fadeIn}
                  fadeOut={fadeOut}
                  displayTime={displayTime}
                  fontSize={fontSize}
                  imageSize={imageSize}
                />
              </div>
            ))}
          </div>
        }
        like={
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: "6px",
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {[...likeFeed].reverse().map((event) => (
              <div key={event.id} style={{ flexShrink: 0 }}>
                <LikeNotification
                  nickname={event.nickname}
                  profileUrl={event.profileUrl}
                  likeCount={event.likeCount}
                  onComplete={handlePersistentComplete}
                  persistent
                  fadeIn={fadeIn}
                  fadeOut={fadeOut}
                  displayTime={displayTime}
                  fontSize={fontSize}
                />
              </div>
            ))}
          </div>
        }
        comment={
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: "6px",
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {[...commentFeed].reverse().map((event) => (
              <div key={event.id} style={{ flexShrink: 0 }}>
                <CommentNotification
                  nickname={event.nickname}
                  profileUrl={event.profileUrl}
                  comment={event.comment}
                  onComplete={handlePersistentComplete}
                  persistent
                  fadeIn={fadeIn}
                  fadeOut={fadeOut}
                  displayTime={displayTime}
                  fontSize={fontSize}
                />
              </div>
            ))}
          </div>
        }
        gift={
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: "6px",
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {[...giftFeed].reverse().map((event) => (
              <div key={event.id} style={{ flexShrink: 0 }}>
                <GiftNotification
                  nickname={event.nickname}
                  profileUrl={event.profileUrl}
                  giftName={event.giftName}
                  quantity={event.quantity}
                  coinValue={event.coinValue}
                  onComplete={handlePersistentComplete}
                  persistent
                  fadeIn={fadeIn}
                  fadeOut={fadeOut}
                  displayTime={displayTime}
                  fontSize={fontSize}
                />
              </div>
            ))}
          </div>
        }
        follow={
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              gap: "6px",
              overflowX: "hidden",
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {[...followFeed].reverse().map((event) => (
              <div key={event.id} style={{ flexShrink: 0 }}>
                <FollowNotification
                  nickname={event.nickname}
                  profileUrl={event.profileUrl}
                  onComplete={handlePersistentComplete}
                  persistent
                  fadeIn={fadeIn}
                  fadeOut={fadeOut}
                  displayTime={displayTime}
                  fontSize={fontSize}
                />
              </div>
            ))}
          </div>
        }
      />
    </div>
  );
}
