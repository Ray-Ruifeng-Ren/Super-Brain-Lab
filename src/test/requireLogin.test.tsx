// 2026-11-01 用户「增加限制,不登录没法使用」:没登录看不到内容,登录后直接进入
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RequireLogin } from "@/components/RequireLogin";

const auth = vi.hoisted(() => ({ state: { user: null as { id: string } | null, loading: false } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/AuthDialog", () => ({ AuthDialog: ({ open }: { open: boolean }) => (open ? <div>登录框</div> : null) }));

const view = () => render(<MemoryRouter><RequireLogin><div>练习内容</div></RequireLogin></MemoryRouter>);

describe("RequireLogin", () => {
  beforeEach(() => { auth.state = { user: null, loading: false }; });
  it("没登录:看不到内容,自动弹登录框", () => {
    view();
    expect(screen.queryByText("练习内容")).toBeNull();
    expect(screen.getByText("登录后才能使用")).toBeTruthy();
    expect(screen.getByText("登录框")).toBeTruthy();
  });
  it("登录状态判断中:不露出内容,也不闪登录框", () => {
    auth.state = { user: null, loading: true };
    view();
    expect(screen.queryByText("练习内容")).toBeNull();
    expect(screen.queryByText("登录框")).toBeNull();
  });
  it("已登录:直接显示内容,不弹登录框(资料还在加载也一样)", () => {
    auth.state = { user: { id: "u1" }, loading: true };
    view();
    expect(screen.getByText("练习内容")).toBeTruthy();
    expect(screen.queryByText("登录框")).toBeNull();
  });
});
