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


async def ensure_workspace_membership(db: AsyncSession, user_id: UUID, workspace_id: UUID) -> None:
    """The tenant-isolation boundary used by every workspace-scoped route and job.

    A workspace ID — whether from a path, a query parameter, or a loaded resource's
    foreign key — is never sufficient authorization on its own. Membership must be
    proven for the authenticated user before the resource lookup or mutation proceeds.
    Raises 404, not 403, so a non-member cannot infer whether the workspace exists.
    """

    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise NOT_FOUND


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
