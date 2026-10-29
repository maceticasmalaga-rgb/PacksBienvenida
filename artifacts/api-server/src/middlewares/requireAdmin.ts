import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const configuredAdminEmails = () =>
  new Set(
    (process.env.MALAGA_ADMIN_EMAIL ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Inicia sesión para continuar." });
    return;
  }

  const allowlist = configuredAdminEmails();
  if (allowlist.size === 0) {
    res.status(503).json({
      error: "La administración aún no tiene una cuenta autorizada.",
    });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    );
    const address = primaryEmail?.emailAddress.trim().toLowerCase();
    const isVerified = primaryEmail?.verification?.status === "verified";

    if (!address || !isVerified || !allowlist.has(address)) {
      res.status(403).json({ error: "No tienes acceso a esta sección." });
      return;
    }

    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not verify administrator access");
    res.status(503).json({
      error: "No se pudo comprobar el acceso de administración.",
    });
  }
};
