import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import T "types/gmail-travel";
import Lib "lib/gmail-travel";

persistent actor Main {
  var tokenStore : Map.Map<Text, Text> = Map.empty();
  var friends : List.List<T.FriendEmail> = List.empty();

  public func getOAuthUrl() : async Text {
    Lib.buildOAuthUrl()
  };

  public func handleOAuthCallback(accessToken : Text, email : Text) : async T.SendResult {
    tokenStore.add("access_token", accessToken);
    tokenStore.add("email", email);
    #ok "authenticated"
  };

  public query func getAuthStatus() : async T.AuthStatus {
    Lib.getAuthStatus(tokenStore)
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
    let storedToken = tokenStore.get("access_token");
    switch (storedToken) {
      case (?token) {
        let fromEmail = switch (tokenStore.get("email")) {
          case (?e) e;
          case null "ggreif@gmail.com";
        };
        await* Lib.sendArrivalEmails(token, fromEmail, friends.toArray(), place)
      };
      case null {
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
