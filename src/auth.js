import * as A from "@netlify/identity";
window.Auth = { login: A.login, signup: A.signup, logout: A.logout, getUser: A.getUser, handleAuthCallback: A.handleAuthCallback, requestPasswordRecovery: A.requestPasswordRecovery, updateUser: A.updateUser, acceptInvite: A.acceptInvite };
