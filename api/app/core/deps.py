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


async def require_workspace_member(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    """Every workspace-scoped route depends on this: it is the tenant-isolation boundary.

    A workspace ID in the path is never sufficient authorization on its own — membership
    must be proven for the authenticated user before the resource lookup proceeds.
    """

    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        # 404, not 403: do not reveal whether a workspace exists to a non-member.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    return workspace
