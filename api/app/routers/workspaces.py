from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_workspace_member
from app.db.models import User, Workspace, WorkspaceMembership
from app.db.session import get_db
from app.schemas import WorkspaceCreate, WorkspaceOut

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[WorkspaceOut]:
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == current_user.id)
        .order_by(Workspace.created_at)
    )
    return [WorkspaceOut.model_validate(w) for w in result.scalars().all()]


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceOut:
    workspace = Workspace(name=payload.name, owner_user_id=current_user.id, retention_days=payload.retention_days)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=current_user.id, role="owner"))
    await db.commit()
    return WorkspaceOut.model_validate(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(workspace: Workspace = Depends(require_workspace_member)) -> WorkspaceOut:
    return WorkspaceOut.model_validate(workspace)
