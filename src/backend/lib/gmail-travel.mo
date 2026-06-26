import Text "mo:core/Text";
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Error "mo:core/Error";
import Debug "mo:core/Debug";
import Char "mo:core/Char";
import Types "../types/gmail-travel";
import Call "mo:ic/Call";
import { type HttpRequestArgs; type HttpRequestResult; type HttpHeader } "mo:ic/Types";

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

  /// Base64url-encode a Blob using the URL-safe alphabet (- and _) with no
  /// padding. The output contains only `[A-Za-z0-9\-_]` so it is safe to embed
  /// directly inside a JSON string literal without further escaping.
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

  /// Send "Gabor arrived in <place>" to all friends.
  ///
  /// This bypasses `googlemail-client`'s `gmail_users_messages_send` because
  /// that function builds the HTTP request body by Candid-encoding the `Message`
  /// record (whose `raw` field is `?Blob`) and then JSON-serializing it via
  /// `mo:serde-core`. `serde-core`'s JSON serializer cannot encode `#Blob`, so
  /// `JSON.fromCandid` returns `#err` and the package throws
  /// `"Failed to serialize body to JSON"` for every recipient.
  ///
  /// Instead we call the IC management canister's `http_request` directly (via
  /// the `mo:ic/Call` wrapper, which attaches the required outcall cycles
  /// internally) with a hand-built JSON body `{"raw":"<base64url>"}`. The
  /// `raw` value is the base64url-encoded RFC822 message, which is exactly what
  /// the Gmail API `users.messages.send` endpoint expects.
  public func sendArrivalEmails(
    accessToken : Text,
    fromEmail : Text,
    recipients : [Types.FriendEmail],
    place : Text,
  ) : async* [Types.SendResult] {
    let subject = "Travel Update from Gabor";
    let body = "Gabor arrived in " # place;
    let results = List.empty<Types.SendResult>();
    let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    let headers : [HttpHeader] = [
      { name = "Authorization"; value = "Bearer " # accessToken },
      { name = "Content-Type"; value = "application/json; charset=utf-8" },
    ];
    for (recipient in recipients.vals()) {
      Debug.print("[Gmail Backend] sendArrivalEmails — sending to recipient: " # recipient);
      let rfc = "From: " # fromEmail # "\r\nTo: " # recipient # "\r\nSubject: " # subject # "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" # body;
      let rawB64 = base64UrlEncode(rfc.encodeUtf8());
      // base64url alphabet is JSON-safe (no quotes/backslashes/control chars),
      // so no escaping is required inside the JSON string literal.
      let jsonBody = "{\"raw\":\"" # rawB64 # "\"}";
      let request : HttpRequestArgs = {
        url;
        method = #post;
        headers;
        body = ?(jsonBody.encodeUtf8());
        max_response_bytes = ?2_000_000;
        transform = null;
        is_replicated = null;
      };
      try {
        let response : HttpRequestResult = await Call.httpRequest(request);
        if (response.status >= 200 and response.status < 300) {
          Debug.print("[Gmail Backend] sendArrivalEmails — result for " # recipient # ": #ok (HTTP " # debug_show(response.status) # ")");
          results.add(#ok recipient);
        } else {
          let bodyText = switch (response.body.decodeUtf8()) {
            case (?t) t;
            case null "(undecodable)";
          };
          Debug.print("[Gmail Backend] sendArrivalEmails — result for " # recipient # ": #err — HTTP " # debug_show(response.status) # " " # bodyText);
          results.add(#err (recipient # ": HTTP " # debug_show(response.status) # " " # bodyText));
        };
      } catch (e) {
        Debug.print("[Gmail Backend] sendArrivalEmails — result for " # recipient # ": #err — exception message: " # e.message());
        results.add(#err (recipient # ": " # e.message()));
      };
    };
    results.toArray()
  };
};
