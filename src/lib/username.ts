/** Usernames are mapped to an internal synthetic email for sign-in. */
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@clientes.gruper.app`;
