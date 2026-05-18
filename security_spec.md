# Security Specification - Learning Wall

## Data Invariants
1. A `WallPost` must be associated with an existing `Category`.
2. A `Category` must have a title and an author.
3. Students can read all categories and posts.
4. Students can create posts.
5. Only the author of a category (or admin) can modify/delete it.
6. Only the teacher (admin/owner) can score or comment on a post.
7. Only the post author or teacher can delete a post. (Wait, the app currently allows students to post without auth, so "post author" isn't strictly tracked via UID). 
Actually, in `LearningWall.tsx`, students post without logging in. So `wall_posts` are created by guests.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a category as another teacher.
2. **Identity Spoofing**: Attempt to update a category that I didn't create.
3. **Identity Spoofing**: Attempt to score a post as a student (guest).
4. **Data Integrity**: Create a post with a 10MB image string (Resource Poisoning).
5. **Data Integrity**: Create a post with a fake `score` field pre-filled.
6. **Data Integrity**: Create a category with a 1MB title (Resource Poisoning).
7. **State Shortcutting**: Update a post's score directly from the client without teacher approval.
8. **Resource Poisoning**: Injection of junk characters into `categoryId` during post creation.
9. **Orphaned Writes**: Creating a post for a non-existent `categoryId`.
10. **Privilege Escalation**: Attempting to delete a category as a guest.
11. **Privilege Escalation**: Attempting to delete a teacher account as a guest.
12. **PII Leak**: Accessing student emails/data from the `students` collection as a guest.

## Test Runner (firestore.rules.test.ts)

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-project",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test("Guest cannot delete a category", async () => {
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(deleteDoc(doc(unauthenticatedDb, "categories/cat1")));
});

test("Guest can read categories", async () => {
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(unauthenticatedDb, "categories/cat1")));
});

test("Guest can create a post", async () => {
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(unauthenticatedDb, "wall_posts/post1"), {
    categoryId: "cat1",
    studentName: "Student",
    imageSrc: "data:image/jpeg;base64,...",
    createdAt: new Date()
  }));
});
```
