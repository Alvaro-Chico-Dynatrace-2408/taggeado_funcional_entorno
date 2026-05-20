import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        <AppHeader.NavItem as={Link} to="/kubernetes">
          Kubernetes
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/non-kubernetes">
          No-Kubernetes
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
