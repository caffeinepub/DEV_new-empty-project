import { createActor } from "@/backend";
import type { FriendEmail } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useState } from "react";

export function useFriends() {
  const { actor, isFetching } = useActor(createActor);
  const [friends, setFriends] = useState<FriendEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFetching || !actor) return;
    let cancelled = false;
    setLoading(true);
    actor
      .getFriends()
      .then((list) => {
        if (!cancelled) setFriends(list);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor, isFetching]);

  const addFriend = useCallback(
    async (email: FriendEmail) => {
      if (!actor) return;
      await actor.addFriend(email);
      setFriends((prev) => (prev.includes(email) ? prev : [...prev, email]));
    },
    [actor],
  );

  const removeFriend = useCallback(
    async (email: FriendEmail) => {
      if (!actor) return;
      // Optimistically update UI first for instant feel
      setFriends((prev) => prev.filter((e) => e !== email));
      await actor.removeFriend(email);
    },
    [actor],
  );

  return { friends, addFriend, removeFriend, loading };
}
