import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as {
    id: string;
    email: string;
    name?: string | null;
    wechatOpenid?: string | null;
    wechatUnionid?: string | null;
    wechatNickname?: string | null;
    wechatAvatar?: string | null;
    wechatBoundAt?: Date | string | null;
    githubId?: number | null;
    githubLogin?: string | null;
    githubAvatar?: string | null;
    githubBoundAt?: Date | string | null;
  };
}
