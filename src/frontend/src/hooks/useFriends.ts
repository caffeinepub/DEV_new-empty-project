import type { FriendEmail } from "@/types";
import { useCallback, useState } from "react";

const FRIENDS_KEY = "gmailer_friends";

function loadFriends(): FriendEmail[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FriendEmail[];
  } catch {
    return [];
  }
}

function saveFriends(friends: FriendEmail[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export function useFriends() {
  const [friends, setFriends] = useState<FriendEmail[]>(loadFriends);

  const addFriend = useCallback((email: FriendEmail) => {
    setFriends((prev) => {
      if (prev.includes(email)) return prev;
      const next = [...prev, email];
      saveFriends(next);
      return next;
    });
  }, []);

  const removeFriend = useCallback((email: FriendEmail) => {
    setFriends((prev) => {
      const next = prev.filter((e) => e !== email);
      saveFriends(next);
      return next;
    });
  }, []);

  return { friends, addFriend, removeFriend };
}
