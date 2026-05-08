import { createFileRoute, Outlet } from "@tanstack/react-router";

// Parent route for /distributors and /distributors/:distributorId.
// Just renders the matched child.
export const Route = createFileRoute("/distributors")({
  component: () => <Outlet />,
});
