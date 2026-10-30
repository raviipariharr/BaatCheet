import { axiosInstance } from "./axios";

export const signup = async (signupData) => {
  const response = await axiosInstance.post("/auth/signup", signupData);
  return response.data;
};

export const login = async (loginData) => {
  const response = await axiosInstance.post("/auth/login", loginData);
  return response.data;
};
export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    console.log("Error in getAuthUser:", error);
    return null;
  }
};

export const completeOnboarding = async (userData) => {
  const response = await axiosInstance.post("/auth/onboarding", userData);
  return response.data;
};

export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data;
}

export async function getRecommendedUsers() {
  const response = await axiosInstance.get("/users");
  return response.data;
}

export async function getOutgoingFriendReqs() {
  const response = await axiosInstance.get("/users/outgoing-friend-requests");
  return response.data;
}

export async function sendFriendRequest(userId) {
  const response = await axiosInstance.post(`/users/friend-request/${userId}`);
  return response.data;
}

export async function getFriendRequests() {
  const response = await axiosInstance.get("/users/friend-requests");
  return response.data;
}

export async function acceptFriendRequest(requestId) {
  const response = await axiosInstance.put(`/users/friend-request/${requestId}/accept`);
  return response.data;
}

export async function getStreamToken() {
  const response = await axiosInstance.get("/chat/token");
  return response.data;
}

export async function updateLanguages(data) {
  const response = await axiosInstance.put("/users/me/languages", data);
  return response.data;
}

export async function translateMessage(messageId) {
  const response = await axiosInstance.post("/chat/translate", { messageId });
  return response.data;
}

export async function getMessages(userId, before) {
  const response = await axiosInstance.get(`/chat/messages/${userId}`, { params: { before } });
  return response.data;
}

export async function getUnreadCounts() {
  const response = await axiosInstance.get("/chat/unread");
  return response.data;
}

export async function updateProfile(data) {
  const response = await axiosInstance.put("/users/me/profile", data);
  return response.data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file); // axios sets the multipart header itself; don't set it manually
  const response = await axiosInstance.put("/users/me/avatar", form);
  return response.data;
}