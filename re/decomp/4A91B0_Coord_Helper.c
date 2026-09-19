// 0x4a91b0 Coord_Helper size=340

_DWORD *__thiscall sub_4A91B0(int this, _DWORD *a2, _DWORD *a3)
{
  _DWORD *v3; // ebp
  bool v4; // zf
  int *v6; // eax
  int v7; // edi
  int v8; // ebx
  int *v9; // ecx
  int v10; // eax
  int v11; // ecx
  _DWORD *v12; // eax
  _DWORD *v13; // eax
  int v14; // ecx
  int v15; // eax
  int v16; // ecx
  __int16 v18; // dx
  _WORD *v19; // eax
  __int16 v20; // dx
  int v21; // ebx
  __int16 v22; // ax
  __int16 v23; // ax
  __int16 v24; // cx
  int v25; // edx
  __int16 v26; // ax
  _DWORD *v27; // [esp+10h] [ebp-14h] BYREF
  __int64 v28; // [esp+14h] [ebp-10h] BYREF
  _BYTE v29[8]; // [esp+1Ch] [ebp-8h] BYREF

  v3 = (_DWORD *)*a3;
  v4 = (unsigned __int16)*a3 == (unsigned __int16)dword_8A03F8;
  a3 = (_DWORD *)*a3;
  if ( v4 && HIWORD(a3) == HIWORD(dword_8A03F8) )
  {
    v6 = (int *)(*(int (__thiscall **)(int, __int64 *))(*(_DWORD *)dword_887640 + 52))(dword_887640, &v28);
    v7 = dword_886FA0;
    v8 = dword_886FA4;
    v9 = v6;
    v10 = *v6;
    v11 = v9[1];
    if ( v10 < dword_886FA0
      || v10 >= dword_886FA0 + dword_886FA8
      || v11 < dword_886FA4
      || v11 >= dword_886FA4 + dword_886FAC )
    {
      v13 = (_DWORD *)(*(int (__thiscall **)(int, _BYTE *))(*(_DWORD *)dword_887640 + 52))(dword_887640, v29);
      v14 = v13[1];
      LODWORD(v28) = *v13 - v7;
      HIDWORD(v28) = v14 - v8;
      v3 = *(_DWORD **)sub_6D6590(&a3, &v28);
    }
    else
    {
      v28 = *(_QWORD *)(*(int (__thiscall **)(int, _BYTE *))(*(_DWORD *)dword_887640 + 52))(dword_887640, v29);
      v12 = *(_DWORD **)sub_653760(&v27, &v28);
      v27 = v12;
      if ( v12 == (_DWORD *)dword_8A03F8 )
        goto LABEL_11;
      v3 = v12;
    }
    a3 = v3;
  }
LABEL_11:
  v15 = *(_DWORD *)(this + 4476);
  if ( v15 != 0 )
  {
    if ( byte_A8ED6B == 0 )
    {
      v18 = HIWORD(a3) + *(_WORD *)(this + 4474);
      LOWORD(v27) = (_WORD)v3 + *(_WORD *)(this + 4472);
      HIWORD(v27) = v18;
      v19 = (_WORD *)sub_6DA360(&v28, &v27, v15);
      v20 = v19[1] - *(_WORD *)(this + 4474);
      LOWORD(a3) = *v19 - *(_WORD *)(this + 4472);
      HIWORD(a3) = v20;
      v3 = a3;
    }
    v4 = (_WORD)v3 == *(_WORD *)(this + 4468);
    a3 = v3;
    if ( v4 && HIWORD(v3) == *(_WORD *)(this + 4470) )
    {
      *a2 = v3;
      return a2;
    }
    else
    {
      v21 = *(_DWORD *)(this + 4468);
      if ( *(_DWORD *)(this + 4476) != 0 )
      {
        if ( v3 != *(_DWORD **)(this + 4468) && *(_DWORD *)(this + 4468) != dword_8A03F8 )
        {
          v22 = *(_WORD *)(this + 4470) + *(_WORD *)(this + 4474);
          LOWORD(a3) = *(_WORD *)(this + 4468) + *(_WORD *)(this + 4472);
          HIWORD(a3) = v22;
          sub_4A95A0(&a3, 0);
        }
        if ( v3 != (_DWORD *)dword_8A03F8 )
        {
          v23 = *(_WORD *)(this + 4472) + (_WORD)v3;
          HIWORD(a3) = HIWORD(v3) + *(_WORD *)(this + 4474);
          LOWORD(a3) = v23;
          sub_4A95A0(&a3, 1);
        }
      }
      *(_DWORD *)(this + 4468) = v3;
      v24 = *(_WORD *)(this + 4472) + (_WORD)v3;
      HIWORD(a3) = *(_WORD *)(this + 4470) + *(_WORD *)(this + 4474);
      v25 = *(_DWORD *)(this + 4476);
      LOWORD(a3) = v24;
      *(_BYTE *)(this + 4480) = sub_4A8EB0(*(_DWORD *)(this + 4520), *(_DWORD *)(this + 4524), v25, &a3);
      v26 = *(_WORD *)(this + 4474) + *(_WORD *)(this + 4470);
      LOWORD(a3) = *(_WORD *)(this + 4468) + *(_WORD *)(this + 4472);
      HIWORD(a3) = v26;
      *(_BYTE *)(this + 4481) = sub_4A9070(
                                  *(_DWORD *)(this + 4520),
                                  *(_DWORD *)(this + 4524),
                                  *(_DWORD *)(this + 4476),
                                  &a3);
      *a2 = v21;
      return a2;
    }
  }
  else
  {
    v16 = *(_DWORD *)(this + 4468);
    *(_DWORD *)(this + 4468) = v3;
    *a2 = v16;
    return a2;
  }
}
