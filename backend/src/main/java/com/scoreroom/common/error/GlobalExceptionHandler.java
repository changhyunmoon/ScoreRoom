package com.scoreroom.common.error;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.scoreroom.common.web.RequestIdFilter;
import com.scoreroom.log.service.LogService;

/** 예외를 { code, message, fieldErrors, requestId } 응답으로 바꾼다 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final LogService logs;

    public GlobalExceptionHandler(LogService logs) {
        this.logs = logs;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApi(ApiException e, HttpServletRequest request) {
        return respond(request, e.code(), e.getMessage(), List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
        List<ApiError.FieldError> fields = e.getBindingResult().getFieldErrors().stream()
                .map(f -> new ApiError.FieldError(f.getField(), f.getDefaultMessage()))
                .toList();
        String message = fields.isEmpty() ? "입력값을 확인해 주세요." : fields.getFirst().message();
        return respond(request, ErrorCode.VALIDATION_FAILED, message, fields);
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, MissingServletRequestPartException.class })
    ResponseEntity<ApiError> handleMalformed(Exception e, HttpServletRequest request) {
        return respond(request, ErrorCode.VALIDATION_FAILED, "요청 형식이 올바르지 않습니다.", List.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> handleTooLarge(MaxUploadSizeExceededException e, HttpServletRequest request) {
        return respond(request, ErrorCode.PAYLOAD_TOO_LARGE, "발표 자료는 파일당 50MB 이하만 올릴 수 있습니다.", List.of());
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    ResponseEntity<ApiError> handleLock(PessimisticLockingFailureException e, HttpServletRequest request) {
        return respond(request, ErrorCode.CONFLICT, "다른 작업을 처리하는 중입니다. 잠시 후 다시 시도해 주세요.", List.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException e, HttpServletRequest request) {
        log.warn("데이터 제약조건 위반: {}", e.getMostSpecificCause().getMessage());
        logs.dataConflict(e, e.getMostSpecificCause());
        return respond(request, ErrorCode.CONFLICT, "다른 변경과 충돌했습니다. 새로 고침한 뒤 다시 시도해 주세요.", List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> handleNoResource(NoResourceFoundException e, HttpServletRequest request) {
        // 없는 주소 요청(정적 파일, 크롤러 등)은 로그를 어지럽히므로 남기지 않는다
        return ResponseEntity.status(ErrorCode.NOT_FOUND.status()).body(new ApiError(ErrorCode.NOT_FOUND.name(),
                "요청한 주소를 찾을 수 없습니다.", List.of(), RequestIdFilter.of(request)));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> handleMethod(HttpRequestMethodNotSupportedException e, HttpServletRequest request) {
        return respond(request, ErrorCode.METHOD_NOT_ALLOWED, "지원하지 않는 요청 방식입니다.", List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnknown(Exception e, HttpServletRequest request) {
        log.error("처리하지 못한 오류", e);
        logs.serverError(e);
        return respond(request, ErrorCode.INTERNAL_ERROR, "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", List.of());
    }

    private ResponseEntity<ApiError> respond(HttpServletRequest request, ErrorCode code, String message,
            List<ApiError.FieldError> fields) {
        logs.rejected(code, message);
        return ResponseEntity.status(code.status())
                .body(new ApiError(code.name(), message, fields, RequestIdFilter.of(request)));
    }
}
