import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";
import { useSocket } from "../context/SocketContext";

const FriendCard = ({ friend }) => {
const { onlineUsers, unread } = useSocket();

const unreadCount = unread[friend._id] || 0;
const isOnline = onlineUsers.has(friend._id);

return ( <div className="card bg-base-200 hover:shadow-md transition-shadow"> <div className="card-body p-4">
{/* USER INFO */} <div className="flex items-center gap-3 mb-3">
<div
className={`avatar size-12 ${
              isOnline ? "online" : "offline"
            }`}
> <img src={friend.profilePic} alt={friend.fullName} /> </div>

```
      <div className="min-w-0">
        <h3 className="font-semibold truncate">
          {friend.fullName}
        </h3>

        <span
          className={`text-xs ${
            isOnline ? "text-success" : "text-base-content/60"
          }`}
        >
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
    </div>

    {/* LANGUAGE INFORMATION */}
    <div className="flex flex-wrap gap-1.5 mb-3">
      <span className="badge badge-secondary text-xs">
        {getLanguageFlag(friend.nativeLanguage)}
        Native: {friend.nativeLanguage}
      </span>

      <span className="badge badge-outline text-xs">
        {getLanguageFlag(friend.learningLanguage)}
        Learning: {friend.learningLanguage}
      </span>
    </div>

    {/* MESSAGE BUTTON WITH UNREAD COUNT */}
    <Link
      to={`/chat/${friend._id}`}
      className="btn btn-outline w-full"
    >
      Message

      {unreadCount > 0 && (
        <span className="badge badge-primary badge-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  </div>
</div>
);
};

export default FriendCard;

export function getLanguageFlag(language) {
if (!language) return null;

const langLower = language.toLowerCase();
const countryCode = LANGUAGE_TO_FLAG[langLower];

if (countryCode) {
return (
<img
src={`https://flagcdn.com/24x18/${countryCode}.png`}
alt={`${langLower} flag`}
className="h-3 mr-1 inline-block"
/>
);
}
return null;
}
