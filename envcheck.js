console.log("PK exists?", !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
console.log("PK prefix:", (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").slice(0,7));
console.log("SK exists?", !!process.env.CLERK_SECRET_KEY);
console.log("SK prefix:", (process.env.CLERK_SECRET_KEY || "").slice(0,7));
