export const githubApiHeaders = (): Readonly<Record<string, string>> => {
  const token = process.env.GH_TOKEN;
  return {
    accept: "application/vnd.github+json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
};
