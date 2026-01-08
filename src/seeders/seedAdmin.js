import { Admin } from "../models/users.model.js";

export const seedDefaultAdmin = async () => {
  const defaultAdmin = {
    name: "Admin",
    email: "admin@gmail.com",
    phone: "0000000000",
    password: "admin",
    role: "Admin",
  };

  const existingAdmin = await Admin.findOne({ email: defaultAdmin.email });
  console.log("existingAdmin", existingAdmin);

  if (!existingAdmin) {
    await Admin.create(defaultAdmin);
    console.log("✅ Default admin user created (admin@gmail.com / admin)");
    return;
  }

  const isPasswordValid = await existingAdmin.isPasswordCorrect(
    defaultAdmin.password
  );

  let shouldUpdate = false;

  if (!isPasswordValid) {
    existingAdmin.password = defaultAdmin.password;
    shouldUpdate = true;
  }

  if (!existingAdmin.phone) {
    existingAdmin.phone = defaultAdmin.phone;
    shouldUpdate = true;
  }

  if (!existingAdmin.name) {
    existingAdmin.name = defaultAdmin.name;
    shouldUpdate = true;
  }

  if (existingAdmin.role !== "Admin") {
    existingAdmin.role = "Admin";
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    await existingAdmin.save();
    console.log("ℹ️ Default admin credentials refreshed");
  } else {
    console.log("ℹ️ Default admin user already present");
  }
};

