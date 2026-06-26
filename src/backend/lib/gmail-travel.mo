import Text "mo:core/Text";
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Error "mo:core/Error";
import Debug "mo:core/Debug";
import Char "mo:core/Char";import Types "../types/gmail-travel";
import { gmail_users_messages_send } "mo:googlemail-client/Apis/UsersApi";
import { defaultConfig } "mo:googlemail-client/Config";
import Option "mo:core/Option";

module {

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


  /// Build the Gmail OAuth authorization URL with pre-filled email hint
  public func buildOAuthUrl() : Text {
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=776815084452-8t1kcrjouc2pp7c6s2r86k41c6cs5mqd.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fnew-empty-project-lcr.dev.caffeine.xyz&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send&login_hint=ggreif%40gmail.com"
  };

  /// Return whether a stored access token is present
  public func getAuthStatus(tokenStore : Map.Map<Text, Text>) : Types.AuthStatus {
    switch (tokenStore.get("access_token")) {
      case (?token) {
        let tokenLen = token.size();
        let tokenPrefix = if (tokenLen >= 8) { takeChars(token, 8) } else { token };
        let email = switch (tokenStore.get("email")) {
          case (?e) e;
          case null "ggreif@gmail.com";
        };
        Debug.print("[Gmail Backend] getAuthStatus — token present (length: " # debug_show(tokenLen) # ", prefix: " # tokenPrefix # ", full token redacted), email: " # email);
        #authenticated { email };
      };
      case null {
        Debug.print("[Gmail Backend] getAuthStatus — token is NULL in tokenStore → #notAuthenticated");
        #notAuthenticated;
      };
    }
  };

  /// Produce a human-readable description of the stored token + AuthStatus for logging
  public func describeAuthStatus(tokenStore : Map.Map<Text, Text>, status : Types.AuthStatus) : Text {
    let tokenDesc = switch (tokenStore.get("access_token")) {
      case (?token) {
        let tokenLen = token.size();
        let tokenPrefix = if (tokenLen >= 8) { takeChars(token, 8) } else { token };
        "present (length: " # debug_show(tokenLen) # ", prefix: " # tokenPrefix # ", full token redacted)"
      };
      case null "NULL (missing)";
    };
    let statusDesc = switch (status) {
      case (#authenticated { email }) "authenticated (email: " # email # ")";
      case (#notAuthenticated) "notAuthenticated";
    };
    "token: " # tokenDesc # ", status: " # statusDesc
  };

  /// Add a friend email to the list; return (newList, added)
  public func addFriend(friends : List.List<Types.FriendEmail>, email : Types.FriendEmail) : (List.List<Types.FriendEmail>, Bool) {
    let found = friends.contains(email);
    if (found) {
      (friends, false)
    } else {
      friends.add(email);
      (friends, true)
    }
  };

  /// Remove a friend email from the list; return (newList, removed)
  public func removeFriend(friends : List.List<Types.FriendEmail>, email : Types.FriendEmail) : (List.List<Types.FriendEmail>, Bool) {
    let before = friends.size();
    let filtered = friends.filter(func(e : Text) : Bool { e != email });
    (filtered, filtered.size() < before)
  };

  /// Base64url-encode a Blob
  func base64UrlEncode(data : Blob) : Text {
    let bytes = data.toArray();
    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let chars = alphabet.toArray();
    var out = "";
    var i = 0;
    let n = bytes.size();
    while (i < n) {
      let b0 = bytes[i].toNat();
      let b1 = if (i + 1 < n) bytes[i + 1].toNat() else 0;
      let b2 = if (i + 2 < n) bytes[i + 2].toNat() else 0;
      out #= Text.fromChar(chars[(b0 / 4) % 64]);
      out #= Text.fromChar(chars[((b0 % 4) * 16 + b1 / 16) % 64]);
      if (i + 1 < n) out #= Text.fromChar(chars[((b1 % 16) * 4 + b2 / 64) % 64]);
      if (i + 2 < n) out #= Text.fromChar(chars[b2 % 64]);
      i += 3;
    };
    out
  };

  /// Send "Gabor arrived in <place>" to all friends using googlemail-client
  public func sendArrivalEmails(
    accessToken : Text,
    fromEmail : Text,
    recipients : [Types.FriendEmail],
    place : Text,
  ) : async* [Types.SendResult] {
    let subject = "Travel Update from Gabor";
    let body = "Gabor arrived in " # place;
    let results = List.empty<Types.SendResult>();
    let cfg = { defaultConfig with auth = ?#bearer accessToken; is_replicated = null };
    for (recipient in recipients.vals()) {
      Debug.print("[Gmail Backend] sendArrivalEmails — sending to recipient: " # recipient);
      let rfc = "From: " # fromEmail # "\r\nTo: " # recipient # "\r\nSubject: " # subject # "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" # body;
      let rawText = base64UrlEncode(rfc.encodeUtf8());
      let rawBlob = rawText.encodeUtf8();
      let msg = {
        id = null;
        threadId = null;
        labelIds = null;
        snippet = null;
        historyId = null;
        internalDate = null;
        payload = null;
        sizeEstimate = null;
        raw = ?(rawBlob);
      };
      try {
        let _ = await* gmail_users_messages_send(cfg, "me", #_1_, "", #json, "", "", "", "", false, "", "", "", msg);
        Debug.print("[Gmail Backend] sendArrivalEmails — result for " # recipient # ": #ok (recipient)");
        results.add(#ok recipient);
      } catch (e) {
        Debug.print("[Gmail Backend] sendArrivalEmails — result for " # recipient # ": #err — exception message: " # e.message());
        results.add(#err (recipient # ": " # e.message()));
      };
    };
    results.toArray()
  };
};
