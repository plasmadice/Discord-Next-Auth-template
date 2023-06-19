import NextAuth, { NextAuthOptions } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"

// https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
const scopes = ["identify", "guilds"].join(" ")

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  
  providers: [
    DiscordProvider({
      clientId: String(process.env.DISCORD_CLIENT_ID),
      clientSecret: String(process.env.DISCORD_CLIENT_SECRET),
      authorization: {
        params: { scope: scopes.concat(" guilds.members.read") },
      },

      async profile(profile, tokens) {
        let isAuthorized = false
        let isAdult = false

        // Fetch the list of servers the user is a member of
        const response = await fetch(
          "https://discord.com/api/users/@me/guilds",
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        )

        const guilds = await response.json()

        // Check if the user is a member of the target server
        const targetGuild = guilds.find(
          (guild: any) => guild.id === process.env.DISCORD_SERVER_ID
        )

        if (targetGuild) {
          // If the user is a member of the target server, they are authorized
          isAuthorized = true

          // Fetch the member data from our auth server
          const memberResponse = await fetch(
            `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`,
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
            }
          )

          const memberData = await memberResponse.json()

          // Check if the member has the 'adult' role
          isAdult =
            isAuthorized &&
            memberData.roles.includes(process.env.DISCORD_ADULT_ROLE)

          // Assign roles to profile
        }

        return {
          id: profile.id,
          name: profile.username,
          email: profile.email,
          image: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
          isAuthorized: isAuthorized,
          isAdult: isAdult,
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account.provider === "discord") {

        // Grant access only if the member has the required role
        return user.isAuthorized
      }

      // Allow sign-in for other providers
      return true
    },
    
    async jwt({ token, user }: any) {
      return { ...token, ...user}
    },
    async session({ session, user, token }: any) {
      session.isAdult = token?.isAdult
      return session
    },
  },
}

export default NextAuth(authOptions)
