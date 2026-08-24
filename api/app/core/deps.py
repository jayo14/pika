from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sessions import SESSION_COOKIE_NAME, read_session
from app.db.models import User, Workspace, WorkspaceMembership
from app.db.session import get_db

UNAUTHENTICATED = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise UNAUTHENTICATED

    user_id = await read_session(session_id)
    if user_id is None:
        raise UNAUTHENTICATED

    user = await db.get(User, user_id)
    if user is None or user.status != "active":
        raise UNAUTHENTICATED
    return user


NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

# Role-based access control: "owner" outranks "member". A workspace's creator is always
# granted "owner" (see auth.signup and workspaces.create_workspace); today that means
# every workspace has exactly one member, but the rank check is what makes future
# multi-member workspaces safe to add without an authorization rewrite.
ROLE_RANK = {"member": 0, "owner": 1}


async def _get_membership(db: AsyncSession, user_id: UUID, workspace_id: UUID) -> WorkspaceMembership | None:
    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def ensure_workspace_membership(db: AsyncSession, user_id: UUID, workspace_id: UUID) -> None:
    """The tenant-isolation boundary used by every workspace-scoped route and job.

    A workspace ID — whether from a path, a query parameter, or a loaded resource's
    foreign key — is never sufficient authorization on its own. Membership must be
    proven for the authenticated user before the resource lookup or mutation proceeds.
    Raises 404, not 403, so a non-member cannot infer whether the workspace exists.
    """

    if await _get_membership(db, user_id, workspace_id) is None:
        raise NOT_FOUND


async def ensure_workspace_role(db: AsyncSession, user_id: UUID, workspace_id: UUID, min_role: str) -> WorkspaceMembership:
    """Membership plus a role check, for actions that are sensitive but not
    tenant-isolation boundaries — e.g. only an owner may revoke a Discord connection or
    change the billing plan. A non-member still gets 404 (see ensure_workspace_membership);
    a member whose role is too low gets 403, since they already know the resource exists.
    """

    membership = await _get_membership(db, user_id, workspace_id)
    if membership is None:
        raise NOT_FOUND
    if ROLE_RANK.get(membership.role, 0) < ROLE_RANK[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires the '{min_role}' role in this workspace.",
        )
    return membership


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Gates the admin API. Never exposed to a normal user — is_staff is set directly in
    the database by an operator, there is no self-service way for a user to grant it."""

    if not current_user.is_staff:
        raise NOT_FOUND
    return current_user


async def require_workspace_member(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise NOT_FOUND
    return workspace
