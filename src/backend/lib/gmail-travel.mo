import Text "mo:core/Text";
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Error "mo:core/Error";
import Types "../types/gmail-travel";
import { gmail_users_messages_send } "mo:googlemail-client/Apis/UsersApi";
import { defaultConfig } "mo:googlemail-client/Config";
import Option "mo:core/Option";

module {

  /// Build the Gmail OAuth authorization URL with pre-filled email hint
  public func buildOAuthUrl() : Text {
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=776815084452-57d5mm927nf70ea4qhuomtuhggges3tj.apps.googleusercontent.com&redirect_uri=REPLACE_WITH_REDIRECT_URI&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send&login_hint=ggreif%40gmail.com"
  };

  /// Return whether a stored access token is present
  public func getAuthStatus(tokenStore : Map.Map<Text, Text>) : Types.AuthStatus {
    switch (tokenStore.get("access_token")) {
      case (?_) {
        let email = switch (tokenStore.get("email")) {
          case (?e) e;
          case null "ggreif@gmail.com";
        };
        #authenticated { email };
      };
      case null #notAuthenticated;
    }
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
    let cfg = { defaultConfig with auth = ?#bearer accessToken };
    for (recipient in recipients.vals()) {
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
        results.add(#ok recipient);
      } catch (e) {
        results.add(#err (recipient # ": " # e.message()));
      };
    };
    results.toArray()
  };
};
