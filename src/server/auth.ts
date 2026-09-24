import bcrypt from "bcryptjs";
import { usersRepo, type UserRow } from "./db";

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: UserRow;
}

export function registerUser(username: string, password: string): AuthResult {
  if (!username || !password) {
    return { ok: false, error: "用户名和密码不能为空" };
  }
  if (password.length < 6) {
    return { ok: false, error: "密码长度至少6位" };
  }
  if (usersRepo.findByUsername(username)) {
    return { ok: false, error: "用户名已存在" };
  }
  const hash = bcrypt.hashSync(password, 10);
  const user = usersRepo.create(username, hash);
  return { ok: true, user };
}

export function verifyLogin(username: string, password: string): AuthResult {
  const user = usersRepo.findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { ok: false, error: "用户名或密码不正确" };
  }
  return { ok: true, user };
}

export function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): AuthResult {
  const user = usersRepo.findById(userId);
  if (!user) return { ok: false, error: "用户不存在" };
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return { ok: false, error: "当前密码不正确" };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "新密码长度至少6位" };
  }
  usersRepo.updatePassword(userId, bcrypt.hashSync(newPassword, 10));
  return { ok: true, user };
}
