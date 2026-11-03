package com.scoreroom.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import com.scoreroom.support.IntegrationTest;
import com.scoreroom.user.domain.User;

class AttachmentApiTest extends IntegrationTest {

    private User leader;
    private User viewer;
    private UUID room;
    private UUID pres;

    @BeforeEach
    void setUp() {
        leader = fixtures.user("leader", null);
        viewer = fixtures.user("viewer", null);
        room = fixtures.room(leader, viewer);
        pres = fixtures.personal(room, leader);
    }

    private ResultActions upload(User user, String name, String text) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", name, "text/html", text.getBytes(StandardCharsets.UTF_8));
        return mvc.perform(multipart("/api/v1/projects/{p}/presentations/{pr}/attachments", room, pres).file(file).with(as(user)));
    }

    @Test
    void 올린_자료는_참여자가_첨부로_내려받고_삭제하면_파일도_지운다() throws Exception {
        String id = com.jayway.jsonpath.JsonPath.read(
                upload(leader, "../발표 자료.html", "<b>hi</b>").andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("발표 자료.html"))
                        .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");

        mvc.perform(get("/api/v1/projects/{p}/presentations/{pr}/attachments/{a}", room, pres, id).with(as(viewer)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/octet-stream"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().string("<b>hi</b>"));

        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}/attachments/{a}", room, pres, id).with(as(viewer)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/{p}/presentations/{pr}/attachments/{a}", room, pres, id).with(as(leader)))
                .andExpect(status().isNoContent());
        assertThat(count("select count(*) from attachments")).isZero();
        assertThat(count("select count(*) from file_deletion_jobs")).isZero();
    }

    @Test
    void 발표당_10개를_넘길_수_없다() throws Exception {
        for (int i = 0; i < 10; i++) {
            upload(leader, "f" + i + ".txt", "x").andExpect(status().isCreated());
        }
        upload(leader, "f10.txt", "x").andExpect(status().isBadRequest());
    }

    @Test
    void 다른_평가룸의_자료는_받을_수_없다() throws Exception {
        String id = com.jayway.jsonpath.JsonPath.read(upload(leader, "a.txt", "x").andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8), "$.id");
        User stranger = fixtures.user("stranger", null);
        mvc.perform(get("/api/v1/projects/{p}/presentations/{pr}/attachments/{a}", room, pres, id).with(as(stranger)))
                .andExpect(status().isForbidden());
    }
}
