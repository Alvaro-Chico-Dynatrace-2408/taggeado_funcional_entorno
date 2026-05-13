import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import { Link } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  path?: string;
}

interface BreadcrumbNavProps {
  items: Breadcrumb[];
}

export const BreadcrumbNav = ({ items }: BreadcrumbNavProps) => {
  return (
    <Flex alignItems="center" gap={4} style={{ marginBottom: 16 }}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Text style={{ opacity: 0.5 }}> / </Text>}
          {item.path ? (
            <Link to={item.path} style={{ textDecoration: "none" }}>
              <Text style={{ cursor: "pointer", opacity: 0.8 }}>{item.label}</Text>
            </Link>
          ) : (
            <Text style={{ fontWeight: 600 }}>{item.label}</Text>
          )}
        </React.Fragment>
      ))}
    </Flex>
  );
};
