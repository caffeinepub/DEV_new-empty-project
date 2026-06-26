module {
  /// Auth status returned to callers
  public type AuthStatus = {
    #authenticated : { email : Text };
    #notAuthenticated;
  };

  /// Result type for operations that can fail
  public type SendResult = {
    #ok : Text;
    #err : Text;
  };

  /// A friend's email address
  public type FriendEmail = Text;
};
