from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.core.sessions import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_session,
    destroy_session,
    set_session_cookie,
)
from app.db.models import User, Workspace, WorkspaceMembership
from app.db.session import get_db
from app.schemas import SessionResponse, SigninRequest, SignupRequest, UserOut, WorkspaceMembershipOut

router = APIRouter(prefix="/auth", tags=["auth"])


async def _load_workspaces(db: AsyncSession, user: User) -> list[WorkspaceMembershipOut]:
    result = await db.execute(
        select(Workspace, WorkspaceMembership.role)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user.id)
        .order_by(Workspace.created_at)
    )
    return [
        WorkspaceMembershipOut(
            id=w.id, name=w.name, owner_user_id=w.owner_user_id, retention_days=w.retention_days, created_at=w.created_at, role=role
        )
        for w, role in result.all()
    ]


@router.post("/signup", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(email=payload.email, password_hash=hash_password(payload.password), display_name=payload.display_name)
    db.add(user)
    await db.flush()

    workspace = Workspace(name=payload.workspace_name or "My Workspace", owner_user_id=user.id)
    db.add(workspace)
    await db.flush()

    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    await db.commit()

    session_id = await create_session(user.id)
    set_session_cookie(response, session_id, settings)
    membership = WorkspaceMembershipOut(
        id=workspace.id,
        name=workspace.name,
        owner_user_id=workspace.owner_user_id,
        retention_days=workspace.retention_days,
        created_at=workspace.created_at,
        role="owner",
    )
    return SessionResponse(user=UserOut.model_validate(user), workspaces=[membership])


@router.post("/signin", response_model=SessionResponse)
async def signin(
    payload: SigninRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    invalid_credentials = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials
    if user.status != "active":
        raise invalid_credentials

    session_id = await create_session(user.id)
    set_session_cookie(response, session_id, settings)
    workspaces = await _load_workspaces(db, user)
    return SessionResponse(user=UserOut.model_validate(user), workspaces=workspaces)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
async def signout(
    request: Request, response: Response, settings: Settings = Depends(get_settings)
) -> None:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        await destroy_session(session_id)
    clear_session_cookie(response, settings)


@router.get("/me", response_model=SessionResponse)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    workspaces = await _load_workspaces(db, current_user)
    return SessionResponse(user=UserOut.model_validate(current_user), workspaces=workspaces)
