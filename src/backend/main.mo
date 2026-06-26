import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Debug "mo:core/Debug";
import Char "mo:core/Char";
import T "types/gmail-travel";
import Lib "lib/gmail-travel";

persistent actor Main {
  /// Return the first `n` characters of `t` (or all of `t` if shorter).
  /// mo:core/Text has no index-based substring; iterate chars instead.
  func takeChars(t : Text, n : Nat) : Text {
    var out = "";
    var i = 0;
    for (c in t.chars()) {
      if (i >= n) return out;
      out #= c.toText();
      i += 1;
    };
    out
  };

  var tokenStore : Map.Map<Text, Text> = Map.empty();
  var friends : List.List<T.FriendEmail> = List.empty();

  public func getOAuthUrl() : async Text {
    Lib.buildOAuthUrl()
  };

  public func handleOAuthCallback(accessToken : Text, email : Text) : async T.SendResult {
    Debug.print("[Gmail Backend] handleOAuthCallback called — email: " # email);
    if (accessToken == "") {
      Debug.print("[Gmail Backend] WARNING: handleOAuthCallback received an EMPTY access_token — refusing to store. OAuth flow did not produce a token.");
      return #err "OAuth callback received an empty access token — please re-authenticate with Gmail";
    };
    let tokenLen = accessToken.size();
    let tokenPrefix = if (tokenLen >= 8) { takeChars(accessToken, 8) } else { accessToken };
    Debug.print("[Gmail Backend] storing access_token — length: " # debug_show(tokenLen) # ", prefix: " # tokenPrefix # " (full token redacted)");
    tokenStore.add("access_token", accessToken);
    tokenStore.add("email", email);
    switch (tokenStore.get("access_token")) {
      case (?_) Debug.print("[Gmail Backend] confirmed: access_token is now present in tokenStore after add");
      case null Debug.print("[Gmail Backend] ERROR: access_token is NULL in tokenStore immediately after add — storage failed");
    };
    #ok "authenticated"
  };

  public query func getAuthStatus() : async T.AuthStatus {
    let status = Lib.getAuthStatus(tokenStore);
    Debug.print("[Gmail Backend] getAuthStatus — " # Lib.describeAuthStatus(tokenStore, status));
    status
  };

  public query func getFriends() : async [T.FriendEmail] {
    friends.toArray()
  };

  public func addFriend(email : T.FriendEmail) : async Bool {
    let (newFriends, added) = Lib.addFriend(friends, email);
    friends := newFriends;
    added
  };

  public func removeFriend(email : T.FriendEmail) : async Bool {
    let (newFriends, removed) = Lib.removeFriend(friends, email);
    friends := newFriends;
    removed
  };

  public func sendArrivalNotification(place : Text, accessToken : Text) : async [T.SendResult] {
    ignore accessToken; // signature kept for frontend compatibility; token is read from tokenStore
    let friendCount = friends.size();
    let storedToken = tokenStore.get("access_token");
    switch (storedToken) {
      case (?token) {
        let tokenLen = token.size();
        let tokenPrefix = if (tokenLen >= 8) { takeChars(token, 8) } else { token };
        Debug.print("[Gmail Backend] sendArrivalNotification — place: " # place # ", friends: " # debug_show(friendCount) # ", token present (length: " # debug_show(tokenLen) # ", prefix: " # tokenPrefix # ", full token redacted)");
        let fromEmail = switch (tokenStore.get("email")) {
          case (?e) e;
          case null "ggreif@gmail.com";
        };
        Debug.print("[Gmail Backend] sendArrivalNotification — fromEmail: " # fromEmail # ", recipient count: " # debug_show(friendCount) # " — calling sendArrivalEmails");
        await* Lib.sendArrivalEmails(token, fromEmail, friends.toArray(), place)
      };
      case null {
        Debug.print("[Gmail Backend] sendArrivalNotification — place: " # place # ", friends: " # debug_show(friendCount) # ", token MISSING in tokenStore — cannot send");
        // Not authenticated — report a clear error per recipient instead of sending with an empty token
        let recipients = friends.toArray();
        let results = List.empty<T.SendResult>();
        for (recipient in recipients.vals()) {
          results.add(#err (recipient # ": Not authenticated — connect Gmail first"));
        };
        results.toArray()
      };
    }
  };
};
